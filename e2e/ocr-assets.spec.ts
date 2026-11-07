import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
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
  const diagnosticsPath = testInfo.outputPath('ocr-browser-diagnostics.json');
  await writeFile(diagnosticsPath, JSON.stringify(diagnostics, null, 2));
  await testInfo.attach('ocr-browser-diagnostics.json', {
    path: diagnosticsPath,
    contentType: 'application/json',
  });
});

const scannedPdf = async (language: 'eng' | 'deu' | 'hin', page: Page) => {
  if (language === 'eng') {
    return {
      name: 'scanned-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: await readFile(resolve(process.cwd(), 'samples/scanned-invoice.pdf')),
    };
  }

  const png = await page.evaluate((selectedLanguage) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2200;
    canvas.height = 3110;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable for scanned fixture generation.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111';
    context.font =
      selectedLanguage === 'hin'
        ? '70px "Noto Sans Devanagari", sans-serif'
        : '65px Arial, sans-serif';
    context.textBaseline = 'top';

    const header =
      selectedLanguage === 'hin'
        ? [
            'कर चालान',
            'चालान संख्या: २०२६०४५७',
            'चालान दिनांक: ०९-१०-२०२६',
            'विक्रेता: हरित क्षेत्र व्यापारी',
            'खरीदार: सूर्योदय खुदरा',
          ]
        : [
            'RECHNUNG',
            'Rechnungsnummer: 2026-0457',
            'Rechnungsdatum: 09.10.2026',
            'Verkäufer: Grünfeld Handel GmbH',
            'Kunde: Sonnenaufgang Einzelhandel',
          ];
    let y = 100;
    for (const line of header) {
      context.fillText(line, 100, y);
      y += 185;
    }

    const rows =
      selectedLanguage === 'hin'
        ? [
            ['विवरण', 'मात्रा', 'दर', 'राशि'],
            ['चावल का बैग', '२', '१०,०००', '२०,०००'],
            ['चीनी का बैग', '१', '१,२००', '१,२००'],
          ]
        : [
            ['Beschreibung', 'Menge', 'Preis', 'Betrag'],
            ['Reis Sack', '2', '10.000,00', '20.000,00'],
            ['Zucker Sack', '1', '1.200,00', '1.200,00'],
          ];
    const x = [100, 1150, 1450, 1800];
    for (const row of rows) {
      row.forEach((cell, index) => context.fillText(cell, x[index], y));
      y += 185;
    }

    const summary =
      selectedLanguage === 'hin'
        ? ['उप-योग: २१,२००', 'कर: १,०६०', 'कुल राशि: २२,२६०']
        : ['Zwischensumme: 21.200,00', 'Steuer: 1.060,00', 'Gesamtbetrag: 22.260,00'];
    y += 30;
    for (const line of summary) {
      context.fillText(line, 100, y);
      y += 185;
    }

    return canvas.toDataURL('image/png').split(',')[1];
  }, language);

  const pdfDocument = await PDFDocument.create();
  const image = await pdfDocument.embedPng(Buffer.from(png, 'base64'));
  const pdfPage = pdfDocument.addPage([595, 842]);
  pdfPage.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
  return {
    name: `scanned-invoice-${language}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdfDocument.save()),
  };
};

async function openApp(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
}

const pdf = async (kind: 'basic' | 'empty', name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture(kind)),
});

test('a text-only PDF does not request an OCR language model', async ({ page }) => {
  const modelRequests: string[] = [];
  page.context().on('request', (request) => {
    if (new URL(request.url()).pathname.includes('.traineddata')) {
      modelRequests.push(request.url());
    }
  });

  await openApp(page);
  await page.setInputFiles('input[type="file"]', await pdf('basic', 'text-only.pdf'));
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });

  expect(modelRequests).toEqual([]);
  await expect(page.getByRole('button', { name: 'Run OCR' })).toHaveCount(0);
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
  language: 'eng' | 'deu' | 'hin',
) => {
  const markersByLanguage = {
    eng: [
      'scanned-invoice.pdf',
      'GT-2026-0457',
      'Greenfield Traders',
      'Sunrise Retail',
      'Rice 25kg bag',
      'Sugar 50kg bag',
      '21,200.00',
      '1,060.00',
      '22,260.00',
    ],
    deu: [
      'scanned-invoice-deu.pdf',
      '2026-0457',
      'Grünfeld Handel GmbH',
      'Sonnenaufgang Einzelhandel',
      'Reis Sack',
      'Zucker Sack',
      '21.200,00',
      '1.060,00',
      '22.260,00',
    ],
    hin: [
      'scanned-invoice-hin.pdf',
      '20260457',
      'हरित क्षेत्र व्यापारी',
      'सूर्योदय खुदरा',
      'चावल का बैग',
      'चीनी का बैग',
      '21,200',
      '1,060',
      '22,260',
    ],
  };
  const markers = markersByLanguage[language];
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

const scannedAnchors = async (page: Page, language: 'eng' | 'deu' | 'hin') => {
  const fileName = language === 'eng' ? 'scanned-invoice.pdf' : `scanned-invoice-${language}.pdf`;
  const reviewButton = page.getByRole('button', { name: `Review ${fileName}` });
  await expect(reviewButton).toBeVisible({ timeout: 30_000 });
  await reviewButton.click();
  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });

  const expected = {
    eng: {
      invoiceNumber: 'GT-2026-0457',
      seller: 'Greenfield Traders',
      subtotal: '21200',
      tax: '1060',
      total: '22260',
      firstItem: 'Rice 25kg bag',
      secondItem: 'Sugar 50kg bag',
    },
    deu: {
      invoiceNumber: '2026-0457',
      seller: 'Grünfeld Handel GmbH',
      subtotal: '21200',
      tax: '1060',
      total: '22260',
      firstItem: 'Reis Sack',
      secondItem: 'Zucker Sack',
    },
    hin: {
      invoiceNumber: '20260457',
      seller: 'हरित क्षेत्र व्यापारी',
      subtotal: '21200',
      tax: '1060',
      total: '22260',
      firstItem: 'चावल का बैग',
      secondItem: 'चीनी का बैग',
    },
  }[language];

  await expect(page.getByLabel('Invoice number')).toHaveValue(expected.invoiceNumber);
  await expect(page.getByLabel('Seller name')).toHaveValue(expected.seller);
  await expect(page.getByLabel('Subtotal')).toHaveValue(expected.subtotal);
  await expect(page.getByLabel('Tax total')).toHaveValue(expected.tax);
  await expect(page.getByLabel('Grand total')).toHaveValue(expected.total);
  await expect(page.getByLabel('Description 1')).toHaveValue(expected.firstItem);
  await expect(page.getByLabel('Description 2')).toHaveValue(expected.secondItem);
};

for (const language of ['eng', 'deu', 'hin'] as const) {
  test(`${language} OCR recognizes the real scanned invoice online and after an offline reload`, async ({
    page,
    context,
  }) => {
    const diagnostics = diagnosticsByPage.get(page)!;

    await openApp(page);
    await expect(
      page.locator('.dx-pwa:visible').getByText('Offline ready', { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Scanned PDF language').selectOption(language);
    if (language === 'deu') await page.getByLabel('Invoice locale').selectOption('de-DE');
    await expect(page.getByText(`${language} OCR model is cached for offline use.`)).toBeVisible({
      timeout: 60_000,
    });
    await page.setInputFiles('input[type="file"]', await scannedPdf(language, page));
    await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Run OCR' }).click();
    await scannedAnchors(page, language);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible(
      {
        timeout: 30_000,
      },
    );
    await expect(
      page.locator('.dx-pwa:visible').getByText('Offline ready', { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Scanned PDF language').selectOption(language);
    if (language === 'deu') await page.getByLabel('Invoice locale').selectOption('de-DE');
    await page.setInputFiles('input[type="file"]', await scannedPdf(language, page));
    await expect(page.getByText('Scanned PDF', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Run OCR' }).click();
    await scannedAnchors(page, language);
    await assertNoInvoiceMarkersPersisted(page, diagnostics.requests, language);
    const appOrigin = new URL(page.url()).origin;
    expect(diagnostics.requests.every((request) => new URL(request.url).origin === appOrigin)).toBe(
      true,
    );

    const origin = new URL(page.url()).origin;
    expect(
      diagnostics.ocrRequests.some((request) => request.path.includes('/ocr/worker.min.js')),
    ).toBe(true);
    expect(diagnostics.ocrRequests.some((request) => request.path.includes('/ocr/core/'))).toBe(
      true,
    );
    expect(
      diagnostics.ocrRequests.some((request) =>
        request.path.includes(`/ocr/lang/${language}.traineddata`),
      ),
    ).toBe(true);
    expect(diagnostics.ocrRequests.every((request) => request.origin === origin)).toBe(true);
    expect(diagnostics.ocrResponses.filter((response) => response.status >= 400)).toEqual([]);
    // Tesseract may abort a duplicate model request after the worker has already
    // received the same cached payload. Treat that as harmless only when the
    // model itself completed successfully and no HTTP OCR response failed.
    const unexpectedOcrFailures = diagnostics.failedRequests.filter(
      (request) => request.includes('/ocr/') && !request.includes('net::ERR_ABORTED'),
    );
    expect(unexpectedOcrFailures).toEqual([]);
  });

  test(`${language} OCR reports an uncached offline model and succeeds on retry`, async ({
    page,
    context,
  }) => {
    const diagnostics = diagnosticsByPage.get(page)!;

    await openApp(page);
    await expect(
      page.locator('.dx-pwa:visible').getByText('Offline ready', { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await context.setOffline(true);
    await page.getByLabel('Scanned PDF language').selectOption(language);
    await page.setInputFiles('input[type="file"]', await scannedPdf(language, page));
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
    await scannedAnchors(page, language);
    await assertNoInvoiceMarkersPersisted(page, diagnostics.requests, language);
    const appOrigin = new URL(page.url()).origin;
    expect(diagnostics.requests.every((request) => new URL(request.url).origin === appOrigin)).toBe(
      true,
    );

    expect(diagnostics.ocrResponses.some((response) => response.status === 503)).toBe(true);
    expect(
      diagnostics.ocrResponses.some(
        (response) =>
          response.path.includes(`/ocr/lang/${language}.traineddata`) && response.status === 200,
      ),
    ).toBe(true);
  });
}
