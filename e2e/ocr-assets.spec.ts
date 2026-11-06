import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

type OcrDiagnostics = {
  consoleErrors: string[];
  failedRequests: string[];
  requests: { url: string; body: string | null }[];
  ocrRequests: { origin: string; path: string }[];
  ocrResponses: { status: number; path: string }[];
};

const diagnosticsByPage = new WeakMap<Page, OcrDiagnostics>();

test.beforeEach(async ({ page }) => {
  const diagnostics: OcrDiagnostics = {
    consoleErrors: [],
    failedRequests: [],
    requests: [],
    ocrRequests: [],
    ocrResponses: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push(
      `${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
    );
  });
  page.on('request', (request) => {
    diagnostics.requests.push({ url: request.url(), body: request.postData() });
    const url = new URL(request.url());
    if (url.pathname.includes('/ocr/')) {
      diagnostics.ocrRequests.push({ origin: url.origin, path: url.pathname });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes('/ocr/')) {
      diagnostics.ocrResponses.push({ status: response.status(), path: url.pathname });
    }
  });
  diagnosticsByPage.set(page, diagnostics);
});

test.afterEach(async ({ page }, testInfo) => {
  const diagnostics = diagnosticsByPage.get(page);
  if (!diagnostics) return;
  await testInfo.attach('ocr-browser-diagnostics.json', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  });
});

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

const assertNoInvoiceMarkersPersisted = async (
  page: Page,
  observedRequests: { url: string; body: string | null }[],
) => {
  const markers = [
    'scanned-invoice.pdf',
    'GT-2026-0457',
    'Greenfield Traders',
    'Sunrise Retail',
    'Rice 25kg bag',
    'Sugar 50kg bag',
    '21,200.00',
    '1,060.00',
    '22,260.00',
  ];
  const persisted = await page.evaluate(async (invoiceMarkers) => {
    const cacheNames = await caches.keys();
    const cacheMatches: { cache: string; url: string; marker: string }[] = [];
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
        for (const marker of invoiceMarkers) {
          const ascii = new TextEncoder().encode(marker);
          const utf16 = new Uint8Array(marker.length * 2);
          for (let index = 0; index < marker.length; index++) {
            utf16[index * 2] = marker.charCodeAt(index);
          }
          if (containsBytes(body, ascii) || containsBytes(body, utf16)) {
            cacheMatches.push({ cache: name, url: request.url, marker });
          }
        }
      }
    }

    return {
      cacheMatches,
      local: Object.values(localStorage),
      session: Object.values(sessionStorage),
      databases:
        typeof indexedDB.databases === 'function'
          ? (await indexedDB.databases()).map((database) => database.name)
          : [],
      urls: [
        window.location.href,
        ...performance.getEntriesByType('resource').map((entry) => entry.name),
      ],
    };
  }, markers);

  expect(persisted.cacheMatches).toEqual([]);
  expect(persisted.databases.filter(Boolean)).toEqual([]);
  for (const marker of markers) {
    expect(JSON.stringify(persisted)).not.toContain(marker);
    expect(JSON.stringify(observedRequests)).not.toContain(marker);
  }
};

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
      const diagnostics = diagnosticsByPage.get(page)!;

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
      await assertNoInvoiceMarkersPersisted(page, diagnostics.requests);
      const appOrigin = new URL(page.url()).origin;
      expect(diagnostics.requests.every((request) => new URL(request.url).origin === appOrigin)).toBe(
        true,
      );

      const origin = new URL(page.url()).origin;
      expect(diagnostics.ocrRequests.some((request) => request.path.includes('/ocr/worker.min.js'))).toBe(true);
      expect(diagnostics.ocrRequests.some((request) => request.path.includes('/ocr/core/'))).toBe(true);
      expect(
        diagnostics.ocrRequests.some((request) =>
          request.path.includes(`/ocr/lang/${language}.traineddata`),
        ),
      ).toBe(true);
      expect(diagnostics.ocrRequests.every((request) => request.origin === origin)).toBe(true);
      expect(diagnostics.ocrResponses.filter((response) => response.status >= 400)).toEqual([]);
      expect(diagnostics.failedRequests.filter((request) => request.includes('/ocr/'))).toEqual([]);
    },
  );

  test(
    `${language} OCR reports an uncached offline model and succeeds on retry`,
    async ({ page, context }) => {
      const diagnostics = diagnosticsByPage.get(page)!;

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
      await assertNoInvoiceMarkersPersisted(page, observedRequests);

      expect(diagnostics.ocrResponses.some((response) => response.status === 503)).toBe(true);
      expect(
        diagnostics.ocrResponses.some(
          (response) =>
            response.path.includes(`/ocr/lang/${language}.traineddata`) && response.status === 200,
        ),
      ).toBe(true);
    },
  );
}
