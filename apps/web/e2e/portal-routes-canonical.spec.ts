import { test, expect } from '@playwright/test';

test.describe('Staff cadastros pendentes', () => {
  test('redirect portal canonical /portal', async ({ page }) => {
    const res = await page.goto('/cliente/portal/login');
    expect(res?.url()).toMatch(/\/portal\/login/);
  });
});
