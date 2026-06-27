import { test, expect } from "@playwright/test";
import { E2E_STAFF_CNPJ, E2E_STAFF_PASSWORD } from "./fixtures/mock-data";
import { setupStaffAuthMock, setupStaffTriagemMocks } from "./fixtures/route-mocks";

test.describe("Cenário 3 — Triagem intranet (Admin)", () => {
  test.describe.configure({ mode: "serial" });

  test("Aprovar pendente confirma status verde (Aprovado)", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupStaffTriagemMocks(page);

    await page.goto("/login/staff?next=/staff/triagem");
    await page.locator("#documento").fill(E2E_STAFF_CNPJ);
    await page.locator("#password").fill(E2E_STAFF_PASSWORD);
    await page.getByRole("button", { name: "Acessar" }).click();

    await page.waitForURL("**/staff/triagem**");
    await expect(page.getByRole("heading", { name: "Triagem de agendamentos" })).toBeVisible();
    await expect(page.getByText("TRI-E2E-001")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "TRI-E2E-001" });
    const aprovar = row.getByRole("button", { name: "Aprovar" });
    await expect(aprovar).toBeEnabled();

    await aprovar.click();

    await expect(page.getByRole("listitem").filter({ hasText: "Agendamento aprovado" })).toBeVisible();
    await expect(page.getByText("Nenhum agendamento aguardando triagem.")).toBeVisible({ timeout: 10_000 });
  });
});
