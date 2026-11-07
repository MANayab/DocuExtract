import { test, expect, type Page } from '@playwright/test';

async function openApp(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Invoice to Excel' })).toBeVisible();
  await page.getByText('Reading options', { exact: true }).click();
}

test('locale panel geometry and keyboard work at common widths', async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);

    const panel = page.locator('.dx-locale-panel');
    const dropzone = page.locator('.dx-drop__zone');
    const localeHint = page.getByText(/Controls how dates and number separators are interpreted/);
    const ocrHint = page.getByText(/Applies only to scanned pages/);

    await expect(panel).toBeVisible();
    await expect(localeHint).toBeVisible();
    await expect(ocrHint).toBeVisible();

    const panelBox = await panel.boundingBox();
    const dropBox = await dropzone.boundingBox();
    const localeBox = await localeHint.boundingBox();
    const ocrBox = await ocrHint.boundingBox();

    expect(panelBox).not.toBeNull();
    expect(dropBox).not.toBeNull();
    expect(localeBox).not.toBeNull();
    expect(ocrBox).not.toBeNull();
    expect(dropBox!.y + dropBox!.height).toBeLessThanOrEqual(panelBox!.y);
    expect(localeBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
    expect(ocrBox!.y + ocrBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await openApp(page);

  const localeSelect = page.getByLabel('Invoice locale');
  const ocrSelect = page.getByLabel('Scanned PDF language');
  await localeSelect.focus();
  await expect(localeSelect).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(ocrSelect).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await localeSelect.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
});
