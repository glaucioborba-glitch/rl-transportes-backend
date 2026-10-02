type GmapsWindow = Window & {
  google?: { maps?: unknown };
  __rlGmapsPromise?: Promise<void>;
};

let overrideKey = "";

export function setGoogleMapsApiKeyOverride(key: string) {
  overrideKey = key.trim();
}

export function googleMapsApiKey(): string {
  return overrideKey || (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export async function resolveGoogleMapsApiKey(): Promise<string> {
  const env = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
  if (env) return env;
  if (overrideKey) return overrideKey;
  try {
    const { fetchTenantMapsConfig } = await import("@/lib/api/tenant-config-client");
    const r = await fetchTenantMapsConfig();
    const k = r.apiKey?.trim() ?? "";
    if (k) setGoogleMapsApiKeyOverride(k);
    return k;
  } catch {
    return "";
  }
}

export function loadGoogleMapsJs(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps só no navegador"));
  const w = window as GmapsWindow;
  if (w.google?.maps) return Promise.resolve();
  if (w.__rlGmapsPromise) return w.__rlGmapsPromise;

  w.__rlGmapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("rl-google-maps-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Google Maps")));
      return;
    }
    const s = document.createElement("script");
    s.id = "rl-google-maps-js";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return w.__rlGmapsPromise;
}
