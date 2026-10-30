import { expect, test } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const pdf = async (kind: 'basic' | 'empty', name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture(kind)),
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

  await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Run OCR' }).click();
  await expect(page.getByText(/OCR failed for hin/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeVisible();
});
