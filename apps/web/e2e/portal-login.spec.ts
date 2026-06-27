import { test, expect } from "@playwright/test";
import { E2E_CNPJ, E2E_PORTAL_PASSWORD } from "./fixtures/mock-data";
import { setupPortalApiMocks } from "./fixtures/route-mocks";

test.describe("Cenário 1 — Login unificado portal", () => {
  test("CNPJ + senha redireciona para o dashboard", async ({ page }) => {
    await setupPortalApiMocks(page);

    await page.goto("/portal/login");
    await expect(page.getByRole("heading", { name: "Portal do cliente" })).toBeVisible();

    await page.getByLabel("CPF ou CNPJ").fill(E2E_CNPJ);
    await page.getByLabel("Senha").fill(E2E_PORTAL_PASSWORD);
    await page.getByRole("button", { name: "Acessar portal" }).click();

    await page.waitForURL("**/portal/dashboard**", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible({ timeout: 15_000 });
  });
});
