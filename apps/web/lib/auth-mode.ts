/** Modo cookies HttpOnly + `credentials: include` (requer CORS_ORIGIN com URL exata do front e AUTH_HTTP_ONLY_COOKIES=1 na API). */
export function isAuthHttpOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_HTTP_ONLY === "1";
}
