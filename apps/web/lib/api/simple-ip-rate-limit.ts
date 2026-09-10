const buckets = new Map<string, { n: number; reset: number }>();

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Rate limit in-memory por IP (processo Next). Middleware não cobre `/api`. */
export function consumeIpRateLimit(req: Request, key: string, max: number, windowMs = 60_000): boolean {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const cur = buckets.get(id);
  if (!cur || now > cur.reset) {
    buckets.set(id, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}
