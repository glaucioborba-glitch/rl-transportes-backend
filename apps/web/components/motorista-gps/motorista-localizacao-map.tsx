"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import type { MotoristaGpsDestino, MotoristaGpsMapaItem } from "@/lib/api/motorista-gps-client";
import {
  motoristaGpsDestinoHtml,
  motoristaGpsDestinoKey,
  motoristaGpsInfoHtml,
  motoristaGpsItemKey,
} from "@/lib/api/motorista-gps-client";
import "leaflet/dist/leaflet.css";

const ITAJAI: [number, number] = [-26.907, -48.661];

type Props = {
  items: MotoristaGpsMapaItem[];
  destinos?: MotoristaGpsDestino[];
  destinoId?: string | null;
  focoKey: string | null;
  focoSeq: number;
  onSelectDestino?: (id: string) => void;
};

function mapaVivo(map: LeafletMap | null): map is LeafletMap {
  if (!map) return false;
  const el = map.getContainer();
  return Boolean(el?.isConnected && map.getPane("mapPane"));
}

function invalidarSeVivo(map: LeafletMap | null) {
  if (!mapaVivo(map)) return;
  const el = map.getContainer();
  if (el.clientWidth < 2 || el.clientHeight < 2) return;
  try {
    map.invalidateSize({ animate: false });
  } catch {
    /* mapa já desmontado (HMR / Strict Mode) */
  }
}

export function MotoristaLocalizacaoMap({
  items,
  destinos = [],
  destinoId,
  focoKey,
  focoSeq,
  onSelectDestino,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const destMarkersRef = useRef<Map<string, CircleMarker>>(new Map());
  const fittedRef = useRef(false);
  const lastFlownSeqRef = useRef(0);
  const onSelectDestinoRef = useRef(onSelectDestino);
  const [mapReady, setMapReady] = useState(false);
  onSelectDestinoRef.current = onSelectDestino;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let map: LeafletMap | null = null;
    let ro: ResizeObserver | null = null;
    let onResize: (() => void) | undefined;
    let t80: number | undefined;
    let raf = 0;

    void import("leaflet").then((L) => {
      if (cancelled || !hostRef.current || mapRef.current) return;
      map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView(ITAJAI, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      const invalidate = () => invalidarSeVivo(mapRef.current);
      raf = requestAnimationFrame(invalidate);
      t80 = window.setTimeout(invalidate, 80);
      onResize = invalidate;
      window.addEventListener("resize", onResize);
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(invalidate);
        ro.observe(hostRef.current);
      }
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (t80 != null) window.clearTimeout(t80);
      if (onResize) window.removeEventListener("resize", onResize);
      ro?.disconnect();
      markersRef.current.clear();
      destMarkersRef.current.clear();
      const alive = mapRef.current ?? map;
      mapRef.current = null;
      if (mapaVivo(alive)) {
        alive.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!mapaVivo(map)) return;
      invalidarSeVivo(map);
      const nextKeys = new Set<string>();
      const withPos: Array<MotoristaGpsMapaItem & { lat: number; lng: number }> = [];

      for (const item of items) {
        const key = motoristaGpsItemKey(item);
        if (item.lat == null || item.lng == null) {
          const stale = markersRef.current.get(key);
          if (stale) {
            stale.remove();
            markersRef.current.delete(key);
          }
          continue;
        }
        nextKeys.add(key);
        withPos.push(item as MotoristaGpsMapaItem & { lat: number; lng: number });
        const color = item.online ? "#22d3ee" : "#64748b";
        const existing = markersRef.current.get(key);
        const popup = motoristaGpsInfoHtml(item);
        if (existing) {
          existing.setLatLng([item.lat, item.lng]);
          existing.setStyle({ color, fillColor: color, radius: item.online ? 10 : 7 });
          existing.setPopupContent(popup);
        } else {
          const marker = L.circleMarker([item.lat, item.lng], {
            radius: item.online ? 10 : 7,
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2,
          })
            .bindPopup(popup)
            .addTo(map);
          markersRef.current.set(key, marker);
        }
      }

      for (const [key, marker] of markersRef.current) {
        if (!nextKeys.has(key)) {
          marker.remove();
          markersRef.current.delete(key);
        }
      }

      if (focoKey) return;
      const destComPonto = destinos.filter((d) => d.lat != null && d.lng != null) as Array<
        MotoristaGpsDestino & { lat: number; lng: number }
      >;
      if (!fittedRef.current && (withPos.length > 0 || destComPonto.length > 0)) {
        fittedRef.current = true;
        const pts: [number, number][] = [
          ...withPos.map((i) => [i.lat, i.lng] as [number, number]),
          ...destComPonto.map((d) => [d.lat, d.lng] as [number, number]),
        ];
        if (pts.length === 1) {
          map.setView(pts[0], 13);
        } else {
          map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
        }
      }
    });
  }, [items, destinos, mapReady, focoKey]);

  useEffect(() => {
    if (!mapReady) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!mapaVivo(map)) return;
      const nextKeys = new Set<string>();
      for (const d of destinos) {
        const key = motoristaGpsDestinoKey(d.id);
        if (d.lat == null || d.lng == null) {
          const stale = destMarkersRef.current.get(key);
          if (stale) {
            stale.remove();
            destMarkersRef.current.delete(key);
          }
          continue;
        }
        nextKeys.add(key);
        const selecionado = d.id === destinoId;
        const popup = motoristaGpsDestinoHtml(d, selecionado);
        const existing = destMarkersRef.current.get(key);
        if (existing) {
          existing.setLatLng([d.lat, d.lng]);
          existing.setStyle({
            color: "#f59e0b",
            fillColor: "#f59e0b",
            radius: selecionado ? 11 : 8,
            weight: selecionado ? 3 : 2,
          });
          existing.setPopupContent(popup);
        } else {
          const marker = L.circleMarker([d.lat, d.lng], {
            radius: selecionado ? 11 : 8,
            color: "#f59e0b",
            fillColor: "#f59e0b",
            fillOpacity: 0.9,
            weight: selecionado ? 3 : 2,
          })
            .bindPopup(popup)
            .addTo(map);
          marker.on("click", () => onSelectDestinoRef.current?.(d.id));
          destMarkersRef.current.set(key, marker);
        }
      }
      for (const [key, marker] of destMarkersRef.current) {
        if (!nextKeys.has(key)) {
          marker.remove();
          destMarkersRef.current.delete(key);
        }
      }
    });
  }, [destinos, destinoId, mapReady]);

  useEffect(() => {
    if (!mapReady || !focoKey) return;
    if (lastFlownSeqRef.current === focoSeq) return;
    const map = mapRef.current;
    const destMarker = destMarkersRef.current.get(focoKey);
    const destino = destinos.find((d) => motoristaGpsDestinoKey(d.id) === focoKey);
    if (destMarker && destino?.lat != null && destino.lng != null) {
      lastFlownSeqRef.current = focoSeq;
      invalidarSeVivo(map);
      if (!mapaVivo(map)) return;
      map.flyTo([destino.lat, destino.lng], Math.max(map.getZoom(), 13), { duration: 0.55 });
      destMarker.openPopup();
      return;
    }
    const marker = markersRef.current.get(focoKey);
    const item = items.find((i) => motoristaGpsItemKey(i) === focoKey);
    if (!mapaVivo(map) || !marker || item?.lat == null || item.lng == null) return;
    lastFlownSeqRef.current = focoSeq;
    invalidarSeVivo(map);
    if (!mapaVivo(map)) return;
    map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 15), { duration: 0.55 });
    marker.openPopup();
  }, [focoKey, focoSeq, mapReady, items, destinos]);

  return <div ref={hostRef} className="h-full w-full bg-zinc-950" />;
}
