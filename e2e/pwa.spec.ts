import { expect, test, type Page } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const appHeading = /PDF Invoice to Excel/i;

const pdf = async (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture('basic')),
});

async function waitForWorker(page: Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible({
    timeout: 30_000,
  });
}

test('reloads offline and performs extraction without caching invoice data', async ({
  page,
  context,
}) => {
  await waitForWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible({
    timeout: 30_000,
  });

  await page.setInputFiles('input[type="file"]', await pdf('offline.pdf'));
  await expect(
    page.getByRole('heading', { name: 'Review extracted fields' }),
  ).toBeVisible({ timeout: 30_000 });

  const storage = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cacheEntries = (
      await Promise.all(
        cacheNames.map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => request.url),
        ),
      )
    ).flat();
    const databases =
      typeof indexedDB.databases === 'function'
        ? await indexedDB.databases()
        : [];
    return {
      cacheEntries,
      local: Object.values(localStorage),
      session: Object.values(sessionStorage),
      databases: databases.map((database) => database.name),
    };
  });

  expect(storage.cacheEntries.some((url) => /offline\.pdf|invoice/i.test(url))).toBe(
    false,
  );
  expect(storage.local.some((value) => /offline\.pdf/i.test(value))).toBe(false);
  expect(storage.session.some((value) => /offline\.pdf/i.test(value))).toBe(false);
  expect(storage.databases.filter(Boolean)).toEqual([]);
});

test('caches OCR models on demand and returns a clear offline error for an uncached language', async ({
  page,
  context,
}) => {
  await waitForWorker(page);

  const online = await page.evaluate(async () => {
    const response = await fetch('/DocuExtract/ocr/lang/eng.traineddata.gz', {
      cache: 'no-store',
    });
    return response.ok;
  });
  expect(online).toBe(true);

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => name.endsWith('-ocr-eng'))).toBe(true);
  expect(
    cacheNames.some(
      (name) => name.endsWith('-ocr-deu') || name.endsWith('-ocr-hin'),
    ),
  ).toBe(false);

  await context.setOffline(true);
  const results = await page.evaluate(async () => {
    const cached = await fetch('/DocuExtract/ocr/lang/eng.traineddata.gz', {
      cache: 'no-store',
    }).then((response) => response.ok);
    const uncached = await fetch('/DocuExtract/ocr/lang/hin.traineddata.gz', {
      cache: 'no-store',
    });
    return {
      cached,
      uncachedStatus: uncached.status,
      uncachedBody: await uncached.json(),
    };
  });

  expect(results.cached).toBe(true);
  expect(results.uncachedStatus).toBe(503);
  expect(results.uncachedBody.error).toBe('OCR_LANGUAGE_NOT_AVAILABLE_OFFLINE');
});

test('failed update checks do not reload or discard the current page', async ({ page }) => {
  await waitForWorker(page);
  const before = page.url();

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update().catch(() => undefined);
  });

  expect(page.url()).toBe(before);
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible();
});
