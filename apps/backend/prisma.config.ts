import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(configDir, "../../.env") });

export default defineConfig({
  schema: "src/prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
});
