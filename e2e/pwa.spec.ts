import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const appHeading = /PDF Invoice to Excel/i;

const pdf = async (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture('basic')),
});

async function waitForWorker(page: Page) {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe('http://127.0.0.1:4173/DocuExtract/');
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible({
    timeout: 30_000,
  });
}

test('reloads offline and performs extraction without caching invoice data', async ({
  page,
  context,
}) => {
  const observedRequests: { url: string; body: string | null }[] = [];
  page.on('request', (request) => {
    observedRequests.push({ url: request.url(), body: request.postData() });
  });
  await waitForWorker(page);
  const precache = await page.evaluate(async () => {
    const response = await fetch('/DocuExtract/precache-manifest.json');
    const manifest = (await response.json()) as {
      version: string;
      buildId: string;
      assets: string[];
    };
    const shellName = (await caches.keys()).find(
      (name) => name === 'docuextract-' + manifest.buildId + '-shell',
    );
    if (!shellName) {
      throw new Error('The application shell cache is missing.');
    }
    const shell = await caches.open(shellName);
    const cachedUrls = new Set((await shell.keys()).map((request) => request.url));
    const missing = manifest.assets
      .map((asset) => new URL('/DocuExtract/' + asset, window.location.origin).href)
      .filter((url) => !cachedUrls.has(url));
    return {
      version: manifest.version,
      buildId: manifest.buildId,
      assets: manifest.assets,
      ocrRuntime: manifest.assets.filter((asset) => asset.startsWith('ocr/')),
      fonts: manifest.assets.filter((asset) => asset.startsWith('standard_fonts/')),
      missing,
      cached: [...cachedUrls],
    };
  });
  expect(precache.version).toBe('1.6.0');
  expect(precache.buildId).toMatch(/^1\.6\.0-[a-f0-9]{10}$/);
  expect(precache.fonts).toHaveLength(14);
  expect(precache.ocrRuntime).toContain('ocr/manifest.json');
  expect(precache.ocrRuntime).toContain('ocr/worker.min.js');
  expect(precache.ocrRuntime.some((asset) => asset.startsWith('ocr/core/'))).toBe(true);
  await expect(page.locator('.dx-pwa:visible').getByText('Offline ready', { exact: true })).toBeVisible({ timeout: 30_000 });
  const extractorAsset = precache.assets.find((asset) => /pdfTextExtractor-.*\.js$/.test(asset));
  expect(extractorAsset).toBeDefined();
  expect(precache.missing).toEqual([]);

  const integrityAsset = precache.assets.find((asset) => asset.startsWith('assets/'));
  if (!integrityAsset) throw new Error('The build manifest contains no application chunks.');
  await context.setOffline(true);
  await page.evaluate(async (asset) => {
    const response = await fetch('/DocuExtract/precache-manifest.json');
    const manifest = (await response.json()) as { buildId: string };
    const cache = await caches.open(`docuextract-${manifest.buildId}-shell`);
    await cache.delete(new URL('/DocuExtract/' + asset, window.location.origin).href);
    window.dispatchEvent(new Event('pageshow'));
  }, integrityAsset);
  await expect(page.locator('.dx-pwa:visible').getByText(/Preparing offline support/)).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
  await expect(page.locator('.dx-pwa:visible').getByText('Offline ready', { exact: true })).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible({
    timeout: 30_000,
  });
  if (!extractorAsset) {
    throw new Error('The PDF text extractor chunk is missing from the build manifest.');
  }
  const offlineExtractor = await page.evaluate(async (asset) => {
    const response = await fetch('/DocuExtract/' + asset);
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
    };
  }, extractorAsset);
  expect(offlineExtractor.status).toBe(200);
  expect(offlineExtractor.contentType).toContain('javascript');

  await page.setInputFiles('input[type="file"]', await pdf('offline.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');
  await expect(page.getByLabel('Description 1')).toHaveValue('Widget');
  await page.getByLabel('Invoice number').fill('PRIVACY-INV-DO-NOT-PERSIST-001');
  await page.getByLabel('Seller name').fill('PRIVACY-SELLER-DO-NOT-PERSIST');
  await page.getByLabel('Description 1').fill('PRIVACY-LINE-DO-NOT-PERSIST');

  const xlsxEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const xlsxDownload = await xlsxEvent;
  const xlsxPath = await xlsxDownload.path();
  if (!xlsxPath) throw new Error('Playwright did not expose the downloaded XLSX file.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(xlsxPath));
  const workbookValues = JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()));
  expect(workbookValues).toContain('PRIVACY-INV-DO-NOT-PERSIST-001');
  expect(workbookValues).toContain('PRIVACY-SELLER-DO-NOT-PERSIST');
  expect(workbookValues).toContain('PRIVACY-LINE-DO-NOT-PERSIST');

  const invoiceCsvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV · invoices' }).click();
  const invoiceCsvDownload = await invoiceCsvEvent;
  const invoiceCsvPath = await invoiceCsvDownload.path();
  if (!invoiceCsvPath) throw new Error('Playwright did not expose the invoice CSV file.');
  const invoiceCsv = await readFile(invoiceCsvPath, 'utf8');
  expect(invoiceCsv).toContain('PRIVACY-INV-DO-NOT-PERSIST-001');
  expect(invoiceCsv).toContain('PRIVACY-SELLER-DO-NOT-PERSIST');

  const lineCsvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV · line items' }).click();
  const lineCsvDownload = await lineCsvEvent;
  const lineCsvPath = await lineCsvDownload.path();
  if (!lineCsvPath) throw new Error('Playwright did not expose the line-item CSV file.');
  expect(await readFile(lineCsvPath, 'utf8')).toContain('PRIVACY-LINE-DO-NOT-PERSIST');

  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON' }).click();
  const jsonDownload = await jsonEvent;
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error('Playwright did not expose the JSON file.');
  const exportedJson = JSON.parse(await readFile(jsonPath, 'utf8')) as unknown;
  expect(JSON.stringify(exportedJson)).toContain('PRIVACY-INV-DO-NOT-PERSIST-001');
  expect(JSON.stringify(exportedJson)).toContain('PRIVACY-LINE-DO-NOT-PERSIST');
  expect(JSON.stringify(exportedJson)).toContain('PRIVACY-SELLER-DO-NOT-PERSIST');

  await page.reload();
  await expect(page.getByRole('heading', { name: appHeading })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PRIVACY-INV-DO-NOT-PERSIST-001')).toHaveCount(0);

  const syntheticMarkers = [
    'INV-BASIC-001',
    'Fictional Meridian Supplies Pvt Ltd',
    'Widget',
    'PRIVACY-INV-DO-NOT-PERSIST-001',
    'PRIVACY-SELLER-DO-NOT-PERSIST',
    'PRIVACY-LINE-DO-NOT-PERSIST',
    'offline.pdf',
  ];
  const storage = await page.evaluate(async (markers) => {
    const cacheNames = await caches.keys();
    const cacheEntries = (
      await Promise.all(
        cacheNames.map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => request.url),
        ),
      )
    ).flat();
    const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
    const cacheMarkerMatches: { cache: string; url: string; marker: string }[] = [];
    const containsBytes = (source: Uint8Array, target: Uint8Array) => {
      for (let start = 0; start <= source.length - target.length; start++) {
        let match = true;
        for (let index = 0; index < target.length; index++) {
          if (source[start + index] !== target[index]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
      return false;
    };

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (!response) continue;
        const body = new Uint8Array(await response.arrayBuffer());
        for (const marker of markers) {
          const ascii = new TextEncoder().encode(marker);
          const utf16 = new Uint8Array(marker.length * 2);
          for (let index = 0; index < marker.length; index++) {
            utf16[index * 2] = marker.charCodeAt(index);
          }
          if (containsBytes(body, ascii) || containsBytes(body, utf16)) {
            cacheMarkerMatches.push({ cache: name, url: request.url, marker });
          }
        }
      }
    }
    const resourceUrls = performance.getEntriesByType('resource').map((entry) => entry.name);

    return {
      cacheEntries,
      cacheMarkerMatches,
      local: Object.values(localStorage),
      session: Object.values(sessionStorage),
      databases: databases.map((database) => database.name),
      resourceUrls,
      location: window.location.href,
    };
  }, syntheticMarkers);

  expect(storage.cacheEntries.some((url) => /offline\.pdf/i.test(url))).toBe(false);
  expect(storage.cacheMarkerMatches).toEqual([]);
  expect(storage.local.some((value) => /offline\.pdf/i.test(value))).toBe(false);
  expect(storage.session.some((value) => /offline\.pdf/i.test(value))).toBe(false);
  expect(storage.databases.filter(Boolean)).toEqual([]);
  const appOrigin = new URL(page.url()).origin;
  expect(observedRequests.every((request) => new URL(request.url).origin === appOrigin)).toBe(true);
  const persisted = JSON.stringify(storage);
  for (const marker of syntheticMarkers) {
    expect(persisted).not.toContain(marker);
    expect(JSON.stringify(observedRequests)).not.toContain(marker);
    expect(JSON.stringify(storage.resourceUrls)).not.toContain(marker);
  }
});

test('prepares a selected OCR language without processing an invoice and reports uncached offline models', async ({
  page,
  context,
}) => {
  await waitForWorker(page);
  await page.selectOption('#ocr-language', 'deu');
  await expect(page.getByText('deu OCR model is cached for offline use.')).toBeVisible({
    timeout: 60_000,
  });

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => name.endsWith('-ocr-deu'))).toBe(true);
  expect(cacheNames.some((name) => name.endsWith('-ocr-eng') || name.endsWith('-ocr-hin'))).toBe(
    false,
  );

  const beforeOffline = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) => ({
        name,
        requests: (await (await caches.open(name)).keys()).map((request) => request.url),
      })),
    );
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      entries,
    };
  });
  expect(beforeOffline.controlled).toBe(true);
  expect(
    beforeOffline.entries
      .flatMap((entry) => entry.requests)
      .some((url) => url.includes('/hin.traineddata.gz')),
  ).toBe(false);

  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  const results = await page.evaluate(async () => {
    const cached = await fetch('/DocuExtract/ocr/lang/deu.traineddata.gz', {
      cache: 'no-store',
    }).then((response) => response.ok);
    const uncached = await fetch('/DocuExtract/ocr/lang/hin.traineddata.gz', { cache: 'no-store' });
    const body = uncached.status === 503 ? await uncached.json() : { error: undefined };

    return {
      cached,
      uncachedStatus: uncached.status,
      uncachedBody: body,
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
