import { test, expect } from '@playwright/test';

test(
  'invoice locale panel stays visible and keyboard operable at responsive widths',
  async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const panel = page.locator('.dx-locale-panel');
      const dropzone = page.locator('.dx-drop__zone');
      const hint = page.getByText(
        /Controls how ambiguous dates and number separators are interpreted/,
      );

      await expect(panel).toBeVisible();
      await expect(hint).toBeVisible();

      const panelBox = await panel.boundingBox();
      const dropBox = await dropzone.boundingBox();
      const hintBox = await hint.boundingBox();

      expect(panelBox).not.toBeNull();
      expect(dropBox).not.toBeNull();
      expect(hintBox).not.toBeNull();
      expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(dropBox!.y);
      expect(hintBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
      expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');

    const select = page.getByLabel('Invoice locale');
    await page.getByRole('link', { name: 'GitHub' }).focus();
    await page.keyboard.press('Tab');
    await expect(select).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(select).toBeVisible();
  },
);
