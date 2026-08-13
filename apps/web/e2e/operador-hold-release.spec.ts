import { test, expect } from "@playwright/test";
import { HoldReleasePage } from "./pages/hold-release.page";
import { setupHoldReleaseMocks, setupStaffAuthMock } from "./fixtures/route-mocks";

test.describe("Operador Hold-Release — Gate-out com Bloqueio", () => {
  test("gate-out com bloqueio financeiro retorna 403 visível na UI", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupHoldReleaseMocks(page, { bloqueioAtivo: true, tipo: "FINANCEIRO" });

    const holdPage = new HoldReleasePage(page);
    await holdPage.gotoCheckout();
    await expect(page.getByText("Vistoria de saída")).toBeVisible();
    await holdPage.advanceToConfirmStep();
    await holdPage.attemptCheckout();

    await holdPage.expectHoldMessage(/bloqueado financeiramente/i);
  });

  test("após pagamento confirmado, gate-out libera automaticamente", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupHoldReleaseMocks(page, { bloqueioAtivo: true, tipo: "FINANCEIRO" });

    const holdPage = new HoldReleasePage(page);
    await holdPage.gotoCheckout();
    await holdPage.advanceToConfirmStep();
    await holdPage.attemptCheckout();
    await holdPage.expectHoldMessage(/bloqueado financeiramente/i);

    await setupHoldReleaseMocks(page, { bloqueioAtivo: false, pagamentoConfirmado: true });
    await holdPage.attemptCheckout();

    await expect(holdPage.getCheckoutSuccess()).toBeVisible();
    await expect(holdPage.getAutoReleaseToast()).toContainText(/liberado automaticamente/i);
  });

  test("bloqueio operacional não auto-libera", async ({ page }) => {
    await setupStaffAuthMock(page);
    await setupHoldReleaseMocks(page, { bloqueioAtivo: true, tipo: "OPERACIONAL" });

    const holdPage = new HoldReleasePage(page);
    await holdPage.gotoCheckout();
    await holdPage.advanceToConfirmStep();
    await holdPage.attemptCheckout();
    await holdPage.expectHoldMessage(/bloqueio operacional/i);

    await setupHoldReleaseMocks(page, {
      bloqueioAtivo: true,
      tipo: "OPERACIONAL",
      pagamentoConfirmado: true,
    });
    await holdPage.attemptCheckout();
    await expect(holdPage.getHoldBlockMessage()).toBeVisible();
  });
});
