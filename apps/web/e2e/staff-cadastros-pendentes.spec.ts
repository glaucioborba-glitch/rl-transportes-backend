import { test, expect } from "@playwright/test";
import { E2E_STAFF_CNPJ, E2E_STAFF_PASSWORD } from "./fixtures/mock-data";
import { setupStaffAuthMock, setupStaffCadastrosPendentesMocks } from "./fixtures/route-mocks";

test.describe("Cenário 4 — Cadastros financeiros pendentes", () => {
  test("Aprovar cadastro portal com condição dinâmica", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupStaffCadastrosPendentesMocks(page);

    await page.goto("/login/staff?next=/financeiro/cadastros-pendentes");
    await page.locator("#documento").fill(E2E_STAFF_CNPJ);
    await page.locator("#password").fill(E2E_STAFF_PASSWORD);
    await page.getByRole("button", { name: "Acessar" }).click();

    await page.waitForURL("**/financeiro/cadastros-pendentes**");
    await expect(page.getByRole("heading", { name: "Novos cadastros pendentes" })).toBeVisible();
    await expect(page.getByText("Nova Empresa E2E LTDA")).toBeVisible();

    await page.getByLabel("Condição de pagamento").selectOption({ label: "À Vista PIX" });
    await page.getByRole("button", { name: "Aprovar" }).click();

    await expect(page.getByText(/aprovado/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Nenhum cadastro pendente no momento.")).toBeVisible({ timeout: 10_000 });
  });
});
