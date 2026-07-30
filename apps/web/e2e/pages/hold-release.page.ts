import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_GATE_IN_ID } from "../fixtures/route-mocks";

export class HoldReleasePage {
  constructor(private page: Page) {}

  async gotoCheckout() {
    await this.page.goto(`/staff/gate/checkout/${E2E_GATE_IN_ID}`);
  }

  async advanceToConfirmStep() {
    await this.page.getByRole("button", { name: "Próximo" }).click();
    const angles = ["FRENTE", "TRASEIRA", "LATERAL_DIREITA", "LATERAL_ESQUERDA"] as const;
    const photo = "e2e/fixtures/photos/frente.jpg";
    for (const angulo of angles) {
      await this.page.getByTestId(`photo-${angulo}`).setInputFiles(photo);
    }
    await this.page.getByRole("button", { name: "Próximo" }).click();
    await this.page.getByRole("button", { name: "Próximo" }).click();
  }

  async attemptCheckout() {
    await this.page.getByTestId("checkout-btn").click();
  }

  getHoldBlockMessage(): Locator {
    return this.page.getByTestId("hold-block-message");
  }

  getCheckoutSuccess(): Locator {
    return this.page.getByTestId("checkout-success");
  }

  getAutoReleaseToast(): Locator {
    return this.page.getByTestId("auto-release-toast");
  }

  async expectHoldMessage(text: RegExp | string) {
    await expect(this.getHoldBlockMessage()).toBeVisible();
    await expect(this.getHoldBlockMessage()).toContainText(text);
    await expect(this.page.getByTestId("hold-block-id")).toBeVisible();
  }
}
