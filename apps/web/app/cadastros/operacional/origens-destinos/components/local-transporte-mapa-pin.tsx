"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsJs, resolveGoogleMapsApiKey } from "@/lib/google-maps-loader";

const ITAJAI = { lat: -26.907, lng: -48.661 };

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export function LocalTransporteMapaPin({ lat, lng, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [key, setKey] = useState("");

  useEffect(() => {
    let on = true;
    void resolveGoogleMapsApiKey().then((k) => {
      if (on) setKey(k);
    });
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !key) return;
    let cancelled = false;
    void loadGoogleMapsJs(key).then(() => {
      if (cancelled || !hostRef.current || mapRef.current) return;
      const maps = google.maps;
      const center = lat != null && lng != null ? { lat, lng } : ITAJAI;
      const map = new maps.Map(hostRef.current, {
        center,
        zoom: lat != null ? 14 : 11,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      const marker = new maps.Marker({
        map,
        position: lat != null && lng != null ? { lat, lng } : undefined,
        draggable: true,
      });
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const p = e.latLng;
        if (!p) return;
        marker.setPosition(p);
        onChange(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)));
      });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (!p) return;
        onChange(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)));
      });
      mapRef.current = map;
      markerRef.current = marker;
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || lat == null || lng == null) return;
    const pos = { lat, lng };
    marker.setPosition(pos);
    map.panTo(pos);
  }, [lat, lng]);

  if (!key) {
    return (
      <p className="text-xs text-muted-foreground">
        Sem chave do Google Maps no front, informe latitude e longitude manualmente.
      </p>
    );
  }

  return <div ref={hostRef} className="h-56 w-full overflow-hidden rounded-md border border-border" />;
}
