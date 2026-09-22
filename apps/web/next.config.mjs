import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";
import { copyFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { join } from "path";

try {
  const require = createRequire(import.meta.url);
  const destDir = join(process.cwd(), "public");
  for (const file of ["pdf.worker.min.mjs", "pdf.min.mjs"]) {
    const workerSrc = require.resolve(`pdfjs-dist/build/${file}`);
    const workerDest = join(destDir, file);
    if (existsSync(workerSrc)) copyFileSync(workerSrc, workerDest);
  }
} catch {
  /* pdfjs-dist ainda não instalado */
}

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
    "http://localhost:39201",
    "http://127.0.0.1:39201",
    "http://localhost:39202",
    "http://127.0.0.1:39202",
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
      script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' data: blob: http://localhost:3001 http://127.0.0.1:3001 https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com ${storageImgHosts.join(" ")};
      connect-src ${buildConnectSrc()} https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com;
      font-src 'self' https://fonts.gstatic.com;
      worker-src 'self' blob:;
      object-src 'self' blob: data:;
      frame-src 'self' blob: data: https://maps.google.com https://www.google.com;
    `.replace(/\s{2,}/g, " "),
  },
];

const nextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-accordion",
      "@radix-ui/react-switch",
      "recharts",
      "@tremor/react",
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = "cheap-module-source-map";
      config.ignoreWarnings = [
        ...(config.ignoreWarnings ?? []),
        { module: /node_modules\/.*\/\.test\./ },
        /Failed to parse source file/,
      ];
    }
    return config;
  },
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
  async redirects() {
    return [
      { source: "/cliente/portal", destination: "/portal", permanent: true },
      { source: "/cliente/portal/:path*", destination: "/portal/:path*", permanent: true },
      {
        source: "/admin/config/regua-cobranca",
        destination: "/cadastros/parametros/financeiro",
        permanent: false,
      },
      {
        source: "/operador/patio/alugueis",
        destination: "/operador/gate/alugueis",
        permanent: false,
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
