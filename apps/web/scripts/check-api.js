const http = require("http");
const https = require("https");

const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const url = new URL(`${raw.replace(/\/$/, "")}/health/diagnostic`);
const lib = url.protocol === "https:" ? https : http;

const req = lib.get(url, (res) => {
  if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
    console.log("✅ API está online em", raw);
    process.exit(0);
  }
  console.warn("⚠️  API respondeu com status", res.statusCode);
  process.exit(0);
});

req.on("error", () => {
  console.warn("⚠️  API não está rodando em", raw);
  console.warn("   Inicie o backend com: cd apps/backend && npm run start:dev");
  console.warn("   Ou na raiz: npm run dev:all:win");
  process.exit(0);
});

req.setTimeout(3000, () => {
  console.warn("⚠️  Timeout ao verificar API em", raw);
  req.destroy();
  process.exit(0);
});
