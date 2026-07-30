import { test, expect } from "@playwright/test";
import { E2E_CNPJ, E2E_PORTAL_PASSWORD } from "./fixtures/mock-data";
import { saveE2ePortalSession, seedPortalPessoaStorage, setupPortalApiMocks } from "./fixtures/route-mocks";

test.describe("Cenário 5 — Financeiro portal", () => {
  test.beforeEach(async ({ page }) => {
    await setupPortalApiMocks(page);
    await seedPortalPessoaStorage(page);

    await page.goto("/portal/login");
    await page.locator("#documento").fill(E2E_CNPJ);
    await page.locator("#password").fill(E2E_PORTAL_PASSWORD);
    await page.getByRole("button", { name: "Acessar portal" }).click();
    await page.waitForURL("**/portal/solicitacoes**", { timeout: 30_000 });
    await saveE2ePortalSession(page);
  });

  test("exibe condição de pagamento contratual", async ({ page }) => {
    await page.goto("/portal/financeiro");
    await expect(page.getByRole("heading", { name: /Financeiro/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Faturamento/i)).toBeVisible();
  });
});
