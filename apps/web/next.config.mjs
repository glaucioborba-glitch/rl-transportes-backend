import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const storageImgHosts = [
  "https://*.amazonaws.com",
  "https://*.cloudflarestorage.com",
  "https://cdn.rltransportes.com",
];

/** Origens permitidas em connect-src (API + WebSocket + Sentry). */
function buildConnectSrc() {
  const origins = new Set([
    "'self'",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "ws://localhost:3000",
    "ws://localhost:3001",
    "https://*.sentry.io",
  ]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      origins.add(`${parsed.protocol}//${parsed.host}`);
      if (parsed.protocol === "https:") {
        origins.add(`wss://${parsed.host}`);
      } else if (parsed.protocol === "http:") {
        origins.add(`ws://${parsed.host}`);
      }
    } catch {
      /* ignore malformed NEXT_PUBLIC_API_URL */
    }
  }
  return [...origins].join(" ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: http://localhost:3001 http://127.0.0.1:3001 ${storageImgHosts.join(" ")};
      connect-src ${buildConnectSrc()};
      font-src 'self';
      frame-src 'self';
    `.replace(/\s{2,}/g, " "),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.rltransportes.com", pathname: "/**" },
      ...(isProd
        ? []
        : [
            { protocol: "http", hostname: "localhost", pathname: "/**" },
            { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
          ]),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

/** BFF e rotas de auth nunca devem ser cacheadas (evita sessão stale pós-logout). */
const apiNetworkOnlyCaching = {
  urlPattern: ({ sameOrigin, url: { pathname } }) =>
    Boolean(
      sameOrigin &&
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/auth/callback"),
    ),
  handler: "NetworkOnly",
  options: {
    cacheName: "apis-network-only",
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: !isProd,
  register: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [apiNetworkOnlyCaching],
  },
});

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  disableLogger: true,
});
