import { expect, test } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

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

  await page.goto('/');
  await page.setInputFiles('input[type="file"]', await pdf('basic', 'text-only.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });

  expect(ocrRequests).toEqual([]);
});

test('loads only the selected same-origin language model and offers retry on 404', async ({ page }) => {
  const modelRequests: { origin: string; path: string }[] = [];
  const ocrAssetOrigins: string[] = [];
  page.context().on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/ocr/')) ocrAssetOrigins.push(url.origin);
    if (url.pathname.includes('.traineddata')) {
      modelRequests.push({ origin: url.origin, path: url.pathname });
    }
  });
  await page.context().route('**/ocr/lang/hin.traineddata.gz', (route) =>
    route.fulfill({ status: 404, body: 'model missing' }),
  );
  await page.goto('/');
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
  expect(modelRequests.every((request) => request.origin === new URL(page.url()).origin)).toBe(true);
  expect(ocrAssetOrigins.length).toBeGreaterThan(0);
  expect(ocrAssetOrigins.every((origin) => origin === new URL(page.url()).origin)).toBe(true);
});
