import { expect, type Locator, type Page } from "@playwright/test";

export class GateCheckinPage {
  constructor(private page: Page) {}

  async gotoPortaria() {
    await this.page.goto("/operador/portaria");
  }

  async openSearch() {
    await this.page.getByRole("button", { name: "Buscar Unidade" }).click();
  }

  async scanQrOrEnterProtocol(protocol: string) {
    await this.page.getByTestId("protocol-input").fill(protocol);
    await this.page.getByTestId("search-credential-btn").click();
  }

  async selectSearchResult(protocol: string) {
    await this.page.getByRole("button", { name: new RegExp(protocol) }).click();
  }

  async confirmCheckin() {
    await this.page.getByTestId("confirm-checkin-btn").click();
  }

  async capturePhoto(angle: string, filePath: string) {
    await this.page.getByTestId(`photo-${angle}`).setInputFiles(filePath);
  }

  async submitVistoria() {
    await this.page.getByTestId("submit-vistoria-btn").click();
  }

  getStatusBadge(): Locator {
    return this.page.getByTestId("status-badge");
  }

  async expectStatus(state: string) {
    await expect(this.getStatusBadge()).toContainText(state);
  }
}
