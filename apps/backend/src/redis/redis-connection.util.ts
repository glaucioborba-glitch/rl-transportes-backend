/** Monta conexão ioredis a partir de REDIS_URL e/ou host+senha. */
export function resolveIoredisTarget(env: {
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
}): { url?: string; host: string; port: number; password?: string } {
  const password = env.REDIS_PASSWORD?.trim() || undefined;
  const urlRaw = env.REDIS_URL?.trim();
  const host = env.REDIS_HOST?.trim() || 'localhost';
  const port = Number(env.REDIS_PORT || '6379') || 6379;

  if (urlRaw) {
    try {
      const u = new URL(urlRaw);
      if (password && !u.password) u.password = password;
      return { url: u.toString(), host: u.hostname || host, port: u.port ? Number(u.port) : port, password: u.password || password };
    } catch {
      return { url: urlRaw, host, port, password };
    }
  }

  return { host, port, password };
}
