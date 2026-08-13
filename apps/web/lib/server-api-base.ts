/** Base URL do Nest (só servidor Next: Route Handlers). */
export function getServerApiBase(): string {
  const raw = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
  return raw.replace(/\/$/, "");
}
