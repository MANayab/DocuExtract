import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const scannedPdf = async () => ({
  name: 'scanned-invoice.pdf',
  mimeType: 'application/pdf',
  buffer: await readFile(resolve(process.cwd(), 'samples/scanned-invoice.pdf')),
});

async function openApp(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
}

const pdf = async (kind: 'basic' | 'empty', name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture(kind)),
});

test('a text-only PDF does not request OCR assets', async ({ page }) => {
  const ocrRequests: string[] = [];
  page.context().on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/ocr/')) {
      ocrRequests.push(request.url());
    }
  });

  await openApp(page);
  await page.setInputFiles('input[type="file"]', await pdf('basic', 'text-only.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });

  expect(ocrRequests).toEqual([]);
});

test('loads only the selected same-origin language model and offers retry on 404', async ({
  page,
}) => {
  const modelRequests: { origin: string; path: string }[] = [];
  const ocrAssetOrigins: string[] = [];
  page.context().on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/ocr/')) ocrAssetOrigins.push(url.origin);
    if (url.pathname.includes('.traineddata')) {
      modelRequests.push({ origin: url.origin, path: url.pathname });
    }
  });
  await page
    .context()
    .route('**/ocr/lang/hin.traineddata*', (route) =>
      route.fulfill({ status: 404, body: 'model missing' }),
    );
  await openApp(page);
  await page.getByLabel('Scanned PDF language').selectOption('hin');
  await page.setInputFiles('input[type="file"]', await pdf('empty', 'missing-model.pdf'));

  await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Run OCR' }).click();
  await expect(page.getByText(/OCR failed for hin/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeVisible();
  expect(modelRequests.length).toBeGreaterThan(0);
  expect(modelRequests.every((request) => request.path.includes('/hin.traineddata'))).toBe(true);
  expect(modelRequests.every((request) => request.origin === new URL(page.url()).origin)).toBe(
    true,
  );
  expect(ocrAssetOrigins.length).toBeGreaterThan(0);
  expect(ocrAssetOrigins.every((origin) => origin === new URL(page.url()).origin)).toBe(true);
});

const scannedAnchors = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel('Invoice number')).toHaveValue('GT-2026-0457');
  await expect(page.getByLabel('Seller name')).toHaveValue('Greenfield Traders');
  await expect(page.getByLabel('Subtotal')).toHaveValue('21200');
  await expect(page.getByLabel('Tax total')).toHaveValue('1060');
  await expect(page.getByLabel('Grand total')).toHaveValue('22260');
  await expect(page.getByLabel('Description 1')).toHaveValue('Rice 25kg bag');
  await expect(page.getByLabel('Description 2')).toHaveValue('Sugar 50kg bag');
};

for (const language of ['eng', 'deu', 'hin'] as const) {
  test(
    `${language} OCR recognizes the real scanned invoice online and after an offline reload`,
    async ({ page, context }) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const ocrRequests: { origin: string; path: string }[] = [];
      const ocrResponses: { status: number; path: string }[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.includes('/ocr/')) {
          ocrRequests.push({ origin: url.origin, path: url.pathname });
        }
      });
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.pathname.includes('/ocr/')) {
          ocrResponses.push({ status: response.status(), path: url.pathname });
        }
      });

      await openApp(page);
      await expect(page.getByText('Offline ready')).toBeVisible({ timeout: 30_000 });
      await page.getByLabel('Scanned PDF language').selectOption(language);
      await expect(page.getByText(`${language} OCR model is cached for offline use.`)).toBeVisible({
        timeout: 60_000,
      });
      await page.setInputFiles('input[type="file"]', await scannedPdf());
      await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole('button', { name: 'Run OCR' }).click();
      await scannedAnchors(page);

      await context.setOffline(true);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible(
        {
          timeout: 30_000,
        },
      );
      await expect(page.getByText('Offline ready')).toBeVisible({ timeout: 30_000 });
      await page.setInputFiles('input[type="file"]', await scannedPdf());
      await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole('button', { name: 'Run OCR' }).click();
      await scannedAnchors(page);

      const origin = new URL(page.url()).origin;
      expect(ocrRequests.some((request) => request.path.includes('/ocr/worker.min.js'))).toBe(true);
      expect(ocrRequests.some((request) => request.path.includes('/ocr/core/'))).toBe(true);
      expect(
        ocrRequests.some((request) => request.path.includes(`/ocr/lang/${language}.traineddata`)),
      ).toBe(true);
      expect(ocrRequests.every((request) => request.origin === origin)).toBe(true);
      expect(ocrResponses.filter((response) => response.status >= 400)).toEqual([]);
      expect(failedRequests.filter((request) => request.includes('/ocr/'))).toEqual([]);
      await test.info().attach(`ocr-${language}-browser-diagnostics.json`, {
        body: JSON.stringify({ consoleErrors, failedRequests, ocrRequests, ocrResponses }, null, 2),
        contentType: 'application/json',
      });
    },
  );

  test(
    `${language} OCR reports an uncached offline model and succeeds on retry`,
    async ({ page, context }) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const ocrResponses: { status: number; path: string }[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`);
      });
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.pathname.includes('/ocr/')) {
          ocrResponses.push({ status: response.status(), path: url.pathname });
        }
      });

      await openApp(page);
      await expect(page.getByText('Offline ready')).toBeVisible({ timeout: 30_000 });
      await context.setOffline(true);
      await page.getByLabel('Scanned PDF language').selectOption(language);
      await page.setInputFiles('input[type="file"]', await scannedPdf());
      await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole('button', { name: 'Run OCR' }).click();
      await expect(page.getByText(/not cached for offline use/i)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeVisible();

      await context.setOffline(false);
      await page.getByRole('button', { name: 'Retry OCR' }).click();
      await scannedAnchors(page);

      expect(ocrResponses.some((response) => response.status === 503)).toBe(true);
      await test.info().attach(`ocr-${language}-retry-diagnostics.json`, {
        body: JSON.stringify({ consoleErrors, failedRequests, ocrResponses }, null, 2),
        contentType: 'application/json',
      });
    },
  );
}
