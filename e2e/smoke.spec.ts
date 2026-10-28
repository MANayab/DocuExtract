import { test, expect } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const pdf = async (kind: 'basic' | 'gst', name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture(kind)),
});

test('upload screen loads with the dashboard shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Invoice to Excel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose PDFs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
});

test('a single PDF goes straight to the review screen with extracted fields', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', await pdf('basic', 'basic.pdf'));

  await expect(
    page.getByRole('heading', { name: 'Review extracted fields' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');
  await expect(page.getByLabel('Grand total')).toHaveValue('1180');
});

test('several PDFs build a batch dashboard with a combined export', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', [
    await pdf('basic', 'a.pdf'),
    await pdf('gst', 'b.pdf'),
  ]);

  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('tbody tr')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Download Excel/ })).toBeEnabled({
    timeout: 30_000,
  });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^docuextract-invoices-\d{8}\.xlsx$/);
});

test('a corrupt PDF fails on its own row and the page stays usable', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', {
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is not a pdf'),
  });

  await expect(page.getByText('The PDF could not be opened.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Choose PDFs' })).toBeVisible();
});

test('serves the SEO essentials', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://manayab.github.io/DocuExtract/',
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);

  for (const file of [
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'og-image.png',
    'manifest.webmanifest',
  ]) {
    const response = await request.get(file);
    expect(response.ok(), file).toBe(true);
  }
});

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
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
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
