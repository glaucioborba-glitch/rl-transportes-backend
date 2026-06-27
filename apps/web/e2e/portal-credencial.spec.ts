import { test, expect } from "@playwright/test";
import {
  buildColetaSolicitacao,
  E2E_CNPJ,
  E2E_PORTAL_PASSWORD,
  E2E_SOLICITACAO_ID,
} from "./fixtures/mock-data";
import { saveE2ePortalSession, seedPortalPessoaStorage, setupPortalApiMocks } from "./fixtures/route-mocks";

function fieldInput(page: import("@playwright/test").Page, label: string) {
  return page.locator(`label:has-text("${label}")`).locator("xpath=following-sibling::*[1]");
}

test.describe("Cenário 2 — Geração de credencial (Coleta + QR Code)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    const solicitacao = buildColetaSolicitacao();
    await setupPortalApiMocks(page, { solicitacao });
    await seedPortalPessoaStorage(page);

    await page.goto("/portal/login");
    await expect(page.getByRole("heading", { name: "Portal do cliente" })).toBeVisible();
    await page.locator("#documento").fill(E2E_CNPJ);
    await page.locator("#password").fill(E2E_PORTAL_PASSWORD);
    await page.getByRole("button", { name: "Acessar portal" }).click();
    await page.waitForURL("**/portal/dashboard**", { timeout: 30_000 });
    await saveE2ePortalSession(page);
  });

  test("Nova solicitação Coleta exibe QR Code na credencial", async ({ page }) => {
    await page.goto("/portal/solicitacoes/nova");
    await expect(page.getByRole("heading", { name: "Nova solicitação (corporativa)" })).toBeVisible();

    await fieldInput(page, "Nome do motorista").fill("Motorista E2E");
    await fieldInput(page, "CPF (apenas dígitos)").fill("52998224725");
    await fieldInput(page, "Placa cavalo").fill("ABC1D23");
    await fieldInput(page, "Placa carreta 01").fill("XYZ9E87");

    await page.getByPlaceholder("AAAA 000000-0").fill("MSCU1234567");
    await page.getByRole("combobox").nth(1).selectOption({ label: '40"' });
    await page.getByRole("combobox").nth(2).selectOption({ label: "HC" });
    await fieldInput(page, "Lacre (obrigatório se cheio)").fill("LACRE-E2E");

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await page.locator('input[type="date"]').fill(tomorrow.toISOString().slice(0, 10));

    await page.getByRole("button", { name: "Salvar solicitação" }).click();
    await page.waitForURL(`**/portal/solicitacoes/${E2E_SOLICITACAO_ID}**`);

    await page.goto("/portal/solicitacoes");
    await expect(page.getByText("E2E-COLETA-001")).toBeVisible();

    await page.getByRole("button", { name: "Credencial (QR Code)" }).click();
    await expect(page.getByText("Credencial de acesso")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  });
});
