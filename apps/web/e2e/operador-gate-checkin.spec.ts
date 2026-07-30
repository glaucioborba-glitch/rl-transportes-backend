import { test, expect } from "@playwright/test";
import { GateCheckinPage } from "./pages/gate-checkin.page";
import { E2E_GATE_PROTOCOL, setupGateOperacaoMocks, setupStaffAuthMock } from "./fixtures/route-mocks";

test.describe("Operador Gate Check-in — Fluxo Portaria", () => {
  test("portaria → check-in → vistoria enviada", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupGateOperacaoMocks(page);

    const gatePage = new GateCheckinPage(page);
    await gatePage.gotoPortaria();
    await gatePage.openSearch();
    await gatePage.scanQrOrEnterProtocol(E2E_GATE_PROTOCOL);
    await gatePage.selectSearchResult(E2E_GATE_PROTOCOL);
    await expect(page.getByTestId("confirm-checkin-btn")).toBeEnabled({ timeout: 10_000 });
    await gatePage.confirmCheckin();
    await expect(page.getByText("Vistoria Fotográfica")).toBeVisible({ timeout: 10_000 });

    const photo = "e2e/fixtures/photos/frente.jpg";
    const labels = [
      "Número do Contêiner",
      "Placa do Cavalo",
      "Lado Frontal",
      "Lado Traseiro (Portas)",
      "Lado Direito",
      "Lado Esquerdo",
    ];
    for (const label of labels) {
      await page.getByRole("button", { name: label }).click();
      await page.getByRole("button", { name: "Tirar foto", exact: true }).click();
      await page.locator('input[type="file"]').last().setInputFiles(photo);
      await expect(page.getByRole("button", { name: label })).toContainText("Registrada", {
        timeout: 15_000,
      });
    }

    await gatePage.submitVistoria();
    await expect(page.getByText("Vistoria enviada")).toBeVisible({ timeout: 10_000 });
  });

  test("vistoria sem todas as fotos obrigatórias bloqueia submit", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupGateOperacaoMocks(page);

    const gatePage = new GateCheckinPage(page);
    await gatePage.gotoPortaria();
    await gatePage.openSearch();
    await gatePage.scanQrOrEnterProtocol(E2E_GATE_PROTOCOL);
    await gatePage.selectSearchResult(E2E_GATE_PROTOCOL);
    await expect(page.getByTestId("confirm-checkin-btn")).toBeEnabled({ timeout: 10_000 });
    await gatePage.confirmCheckin();
    await expect(page.getByTestId("submit-vistoria-btn")).toBeDisabled();
  });
});
