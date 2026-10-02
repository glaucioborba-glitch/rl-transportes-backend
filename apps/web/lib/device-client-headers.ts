/** Headers de dispositivo para segurança de sessão (backend combina com IP/UA). */

async function sha256Hex(text: string): Promise<string> {
  if (typeof window === "undefined" || !globalThis.crypto?.subtle) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return `fallback:${(h >>> 0).toString(16).padStart(8, "0")}`;
  }
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash estável no browser (timezone + UA + SO + resolução). */
export async function buildDeviceFingerprintHash(): Promise<string> {
  if (typeof window === "undefined") return "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const ua = navigator.userAgent || "";
  const plat = navigator.platform || "";
  const screen =
    typeof window.screen?.width === "number" && typeof window.screen?.height === "number"
      ? `${window.screen.width}x${window.screen.height}`
      : "";
  const raw = [tz, ua, plat, screen].join("|");
  return sha256Hex(raw);
}

/** Objeto para mesclar em `headers` de fetch (somente browser). */
export async function getDeviceSecurityHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const fp = await buildDeviceFingerprintHash();
  const out: Record<string, string> = {
    "x-device-fingerprint": fp,
    "x-device-os": navigator.platform || "",
    "x-device-browser": navigator.userAgent || "",
    "x-device-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
  if (typeof window.screen?.width === "number" && typeof window.screen?.height === "number") {
    out["x-device-screen"] = `${window.screen.width}x${window.screen.height}`;
  }
  return out;
}

export async function appendDeviceSecurityHeaders(headers: Headers): Promise<void> {
  const h = await getDeviceSecurityHeaders();
  for (const [k, v] of Object.entries(h)) {
    if (v) headers.set(k, v);
  }
}
