/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
let apiOriginForCsp = "http://localhost:3000";
try {
  apiOriginForCsp = new URL(apiUrl).origin;
} catch {
  /* keep default */
}

const connectSrcParts = [
  "'self'",
  apiOriginForCsp,
  "https://api.rltransportes.com",
  "wss://api.rltransportes.com",
];
if (!isProd) {
  connectSrcParts.push("http://127.0.0.1:*", "http://localhost:*", "ws://localhost:*", "ws://127.0.0.1:*");
}

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  `connect-src ${[...new Set(connectSrcParts)].join(" ")}`,
  "img-src 'self' data: https://cdn.rltransportes.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
    const base = [
      { key: "Content-Security-Policy", value: cspDirectives },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];
    if (isProd) {
      base.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: base }];
  },
};

export default nextConfig;
