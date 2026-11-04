import { expect, test } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const pdf = async (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture('basic')),
});

async function waitForWorker(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test('reloads offline and performs extraction without caching invoice data', async ({ page, context }) => {
  await waitForWorker(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /PDF invoices/i })).toBeVisible({ timeout: 30_000 });

  await page.setInputFiles('input[type="file"]', await pdf('offline.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({ timeout: 30_000 });

  const cacheEntries = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(names.map(async (name) => ({ name, keys: (await (await caches.open(name)).keys()).map((request) => request.url) })));
    return entries.flatMap((entry) => entry.keys);
  });
  expect(cacheEntries.some((url) => /offline\.pdf|invoice/i.test(url))).toBe(false);
});

test('caches OCR models on demand and keeps languages isolated', async ({ page, context }) => {
  await waitForWorker(page);
  await page.evaluate(async () => {
    await fetch('/DocuExtract/ocr/lang/eng.traineddata.gz');
  });

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => name.endsWith('-ocr-eng'))).toBe(true);
  expect(cacheNames.some((name) => name.endsWith('-ocr-deu') || name.endsWith('-ocr-hin'))).toBe(false);

  await context.setOffline(true);
  const results = await page.evaluate(async () => {
    const cached = await fetch('/DocuExtract/ocr/lang/eng.traineddata.gz').then((response) => response.ok).catch(() => false);
    const uncached = await fetch('/DocuExtract/ocr/lang/hin.traineddata.gz').then((response) => response.ok).catch(() => false);
    return { cached, uncached };
  });
  expect(results.cached).toBe(true);
  expect(results.uncached).toBe(false);
});

test('offline navigation recovers after a failed update check without automatic reload', async ({ page }) => {
  await waitForWorker(page);
  const url = page.url();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const original = registration.update.bind(registration);
    Object.defineProperty(registration, 'update', { value: async () => { throw new Error('offline'); } });
    await registration.update().catch(() => undefined);
    Object.defineProperty(registration, 'update', { value: original });
  }).catch(() => undefined);
  expect(page.url()).toBe(url);
  await expect(page.getByRole('heading', { name: /PDF invoices/i })).toBeVisible();
});
