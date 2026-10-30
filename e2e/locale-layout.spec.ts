import { test, expect } from '@playwright/test';

test('locale panel geometry and keyboard work at common widths', async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const panel = page.locator('.dx-locale-panel');
    const dropzone = page.locator('.dx-drop__zone');
    const localeHint = page.getByText(
      /Controls how ambiguous dates and number separators are interpreted/,
    );
    const ocrHint = page.getByText(
      /Applies only to scanned or image-only pages/,
    );

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
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(dropBox!.y);
    expect(localeBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
    expect(ocrBox!.y + ocrBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');

  const localeSelect = page.getByLabel('Invoice locale');
  const ocrSelect = page.getByLabel('Scanned PDF language');
  await page.locator('.dx-header').getByRole('link', { name: 'GitHub' }).focus();
  await page.keyboard.press('Tab');
  await expect(localeSelect).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(ocrSelect).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
});
