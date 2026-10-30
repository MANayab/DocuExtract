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

  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');
  await expect(page.getByLabel('Grand total')).toHaveValue('1180');
});

test('several PDFs build a batch dashboard with a combined export', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', [await pdf('basic', 'a.pdf'), await pdf('gst', 'b.pdf')]);

  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('tbody tr')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Download Excel/ })).toBeEnabled({ timeout: 30_000 });

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


test('a text-only PDF does not request OCR assets', async ({ page }) => {
  const ocrRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/ocr/')) {
      ocrRequests.push(request.url());
    }
  });

  await page.goto('/');
  await page.setInputFiles('input[type="file"]', await pdf('basic', 'text-only.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });

  expect(ocrRequests).toEqual([]);
});

test('a missing selected language model shows an error and a retry action', async ({ page }) => {
  await page.route('**/ocr/lang/hin.traineddata.gz', (route) =>
    route.fulfill({ status: 404, body: 'model missing' }),
  );
  await page.goto('/');
  await page.getByLabel('Scanned PDF language').selectOption('hin');
  await page.setInputFiles('input[type="file"]', await pdf('empty', 'missing-model.pdf'));

  await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Run OCR' }).click();
  await expect(page.getByText(/OCR failed/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeVisible();
});

test('serves the SEO essentials', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://manayab.github.io/DocuExtract/');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);

  for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt', 'og-image.png', 'manifest.webmanifest']) {
    const response = await request.get(file);
    expect(response.ok(), file).toBe(true);
  }
});
