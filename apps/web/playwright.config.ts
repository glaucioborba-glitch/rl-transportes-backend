import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: process.env.CI
      ? `npm run build && npm run start -- -p ${port}`
      : `npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 300_000 : 120_000,
    env: {
      E2E_MOCK_AUTH: "1",
      NEXT_PUBLIC_E2E_MOCK_AUTH: "1",
      NEXT_PUBLIC_PORTAL_COOKIE_AUTH: "0",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3001",
    },
  },
});
