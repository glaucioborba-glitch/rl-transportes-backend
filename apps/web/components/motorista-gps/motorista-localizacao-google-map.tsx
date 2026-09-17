"use client";

import { useEffect, useRef, useState } from "react";
import type { MotoristaGpsDestino, MotoristaGpsMapaItem } from "@/lib/api/motorista-gps-client";
import {
  motoristaGpsDestinoHtml,
  motoristaGpsDestinoKey,
  motoristaGpsInfoHtml,
  motoristaGpsItemKey,
} from "@/lib/api/motorista-gps-client";
import { googleMapsApiKey, loadGoogleMapsJs } from "@/lib/google-maps-loader";
import { decodeGooglePolyline } from "@/lib/google-polyline";

const ITAJAI = { lat: -26.907, lng: -48.661 };

type Props = {
  items: MotoristaGpsMapaItem[];
  destinos?: MotoristaGpsDestino[];
  destinoId?: string | null;
  focoKey: string | null;
  focoSeq: number;
  onSelectDestino?: (id: string) => void;
};

type GMap = google.maps.Map;
type GMarker = google.maps.Marker;

function gmaps(): typeof google.maps | null {
  return typeof google === "undefined" ? null : google.maps;
}

export function MotoristaLocalizacaoGoogleMap({
  items,
  destinos = [],
  destinoId,
  focoKey,
  focoSeq,
  onSelectDestino,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<Map<string, GMarker>>(new Map());
  const destMarkersRef = useRef<Map<string, GMarker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const itemsRef = useRef(items);
  const destinosRef = useRef(destinos);
  const onSelectDestinoRef = useRef(onSelectDestino);
  const fittedRef = useRef(false);
  const lastFlownSeqRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  itemsRef.current = items;
  destinosRef.current = destinos;
  onSelectDestinoRef.current = onSelectDestino;

  useEffect(() => {
    const host = hostRef.current;
    const key = googleMapsApiKey();
    if (!host || !key) {
      setLoadErr("Chave do Google Maps ausente.");
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    void loadGoogleMapsJs(key)
      .then(() => {
        if (cancelled || !hostRef.current || mapRef.current) return;
        const maps = gmaps();
        if (!maps) throw new Error("Google Maps não inicializou");
        const map = new maps.Map(hostRef.current, {
          center: ITAJAI,
          zoom: 12,
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        const traffic = new maps.TrafficLayer();
        traffic.setMap(map);
        mapRef.current = map;
        trafficRef.current = traffic;
        infoRef.current = new maps.InfoWindow();
        routeRef.current = new maps.Polyline({
          strokeColor: "#22d3ee",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        });
        const resize = () => {
          if (!mapRef.current) return;
          maps.event.trigger(mapRef.current, "resize");
        };
        requestAnimationFrame(resize);
        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(resize);
          ro.observe(hostRef.current);
        }
        setMapReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Não foi possível abrir o Google Maps");
      });

    return () => {
      cancelled = true;
      ro?.disconnect();
      for (const m of markersRef.current.values()) m.setMap(null);
      markersRef.current.clear();
      for (const m of destMarkersRef.current.values()) m.setMap(null);
      destMarkersRef.current.clear();
      routeRef.current?.setMap(null);
      routeRef.current = null;
      trafficRef.current?.setMap(null);
      trafficRef.current = null;
      infoRef.current?.close();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const maps = gmaps();
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    const nextKeys = new Set<string>();
    const withPos: Array<MotoristaGpsMapaItem & { lat: number; lng: number }> = [];

    for (const item of items) {
      const key = motoristaGpsItemKey(item);
      if (item.lat == null || item.lng == null) {
        const stale = markersRef.current.get(key);
        if (stale) {
          stale.setMap(null);
          markersRef.current.delete(key);
        }
        continue;
      }
      nextKeys.add(key);
      withPos.push(item as MotoristaGpsMapaItem & { lat: number; lng: number });
      const color = item.online ? "#22d3ee" : "#64748b";
      const title = `${item.nome} · ${item.tipo}${item.placaCavalo ? ` · ${item.placaCavalo}` : ""}`;
      const existing = markersRef.current.get(key);
      if (existing) {
        existing.setPosition({ lat: item.lat, lng: item.lng });
        existing.setTitle(title);
        existing.setIcon({
          path: maps.SymbolPath.CIRCLE,
          scale: item.online ? 9 : 7,
          fillColor: color,
          fillOpacity: 0.95,
          strokeColor: "#041014",
          strokeWeight: 2,
        });
      } else {
        const marker = new maps.Marker({
          map,
          position: { lat: item.lat, lng: item.lng },
          title,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: item.online ? 9 : 7,
            fillColor: color,
            fillOpacity: 0.95,
            strokeColor: "#041014",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          const current = itemsRef.current.find((i) => motoristaGpsItemKey(i) === key);
          if (!current) return;
          infoRef.current?.setContent(motoristaGpsInfoHtml(current));
          infoRef.current?.open({ map, anchor: marker });
        });
        markersRef.current.set(key, marker);
      }
    }

    for (const [key, marker] of markersRef.current) {
      if (!nextKeys.has(key)) {
        marker.setMap(null);
        markersRef.current.delete(key);
      }
    }

    if (focoKey) return;
    routeRef.current?.setMap(null);
    const destComPonto = destinos.filter((d) => d.lat != null && d.lng != null) as Array<
      MotoristaGpsDestino & { lat: number; lng: number }
    >;
    if (!fittedRef.current && (withPos.length > 0 || destComPonto.length > 0)) {
      fittedRef.current = true;
      const bounds = new maps.LatLngBounds();
      for (const p of withPos) bounds.extend({ lat: p.lat, lng: p.lng });
      for (const d of destComPonto) bounds.extend({ lat: d.lat, lng: d.lng });
      map.fitBounds(bounds, 48);
    }
  }, [items, destinos, mapReady, focoKey]);

  useEffect(() => {
    const maps = gmaps();
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;
    const nextKeys = new Set<string>();
    for (const d of destinos) {
      const key = motoristaGpsDestinoKey(d.id);
      if (d.lat == null || d.lng == null) {
        const stale = destMarkersRef.current.get(key);
        if (stale) {
          stale.setMap(null);
          destMarkersRef.current.delete(key);
        }
        continue;
      }
      nextKeys.add(key);
      const selecionado = d.id === destinoId;
      const icon = {
        path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: selecionado ? 7 : 5,
        fillColor: "#f59e0b",
        fillOpacity: 0.95,
        strokeColor: selecionado ? "#fff7ed" : "#041014",
        strokeWeight: 2,
        rotation: 180,
      };
      const title = `${d.nome} · ${d.codigo}`;
      const existing = destMarkersRef.current.get(key);
      if (existing) {
        existing.setPosition({ lat: d.lat, lng: d.lng });
        existing.setTitle(title);
        existing.setIcon(icon);
      } else {
        const marker = new maps.Marker({
          map,
          position: { lat: d.lat, lng: d.lng },
          title,
          icon,
        });
        marker.addListener("click", () => {
          const current = destinosRef.current.find((x) => motoristaGpsDestinoKey(x.id) === key);
          if (!current) return;
          onSelectDestinoRef.current?.(current.id);
          infoRef.current?.setContent(motoristaGpsDestinoHtml(current, true));
          infoRef.current?.open({ map, anchor: marker });
        });
        destMarkersRef.current.set(key, marker);
      }
    }
    for (const [key, marker] of destMarkersRef.current) {
      if (!nextKeys.has(key)) {
        marker.setMap(null);
        destMarkersRef.current.delete(key);
      }
    }
  }, [destinos, destinoId, mapReady]);

  useEffect(() => {
    if (!mapReady || !focoKey) return;
    const maps = gmaps();
    const map = mapRef.current;
    if (!maps || !map) return;

    const destMarker = destMarkersRef.current.get(focoKey);
    const destino = destinos.find((d) => motoristaGpsDestinoKey(d.id) === focoKey);
    if (destMarker && destino?.lat != null && destino.lng != null) {
      infoRef.current?.setContent(motoristaGpsDestinoHtml(destino, destino.id === destinoId));
      infoRef.current?.open({ map, anchor: destMarker });
      if (lastFlownSeqRef.current === focoSeq) return;
      lastFlownSeqRef.current = focoSeq;
      map.panTo({ lat: destino.lat, lng: destino.lng });
      if ((map.getZoom() ?? 12) < 13) map.setZoom(13);
      return;
    }

    const route = routeRef.current;
    const marker = markersRef.current.get(focoKey);
    const item = items.find((i) => motoristaGpsItemKey(i) === focoKey);
    if (!marker || item?.lat == null || item.lng == null) return;

    const path = decodeGooglePolyline(item.rotaPolyline);
    if (route) {
      if (path.length > 1) {
        route.setPath(path);
        route.setMap(map);
      } else {
        route.setMap(null);
      }
    }

    infoRef.current?.setContent(motoristaGpsInfoHtml(item));
    infoRef.current?.open({ map, anchor: marker });

    if (lastFlownSeqRef.current === focoSeq) return;
    lastFlownSeqRef.current = focoSeq;
    if (path.length > 1) {
      const bounds = new maps.LatLngBounds();
      for (const p of path) bounds.extend(p);
      map.fitBounds(bounds, 56);
    } else {
      map.panTo({ lat: item.lat, lng: item.lng });
      if ((map.getZoom() ?? 12) < 15) map.setZoom(15);
    }
  }, [focoKey, focoSeq, mapReady, items, destinos, destinoId]);

  return (
    <div className="relative h-full w-full bg-zinc-950">
      <div ref={hostRef} className="h-full w-full" />
      {loadErr ? (
        <p className="absolute inset-x-0 top-3 mx-auto max-w-md rounded-md bg-red-950/90 px-3 py-2 text-center text-sm text-red-200">
          {loadErr}
        </p>
      ) : null}
    </div>
  );
}
