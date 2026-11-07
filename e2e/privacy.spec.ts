import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const storageKey = 'docuextract.vendor-templates.v1';
const privacyMarkers = [
  'PRIVACY-INV-DO-NOT-PERSIST-001',
  'PRIVACY-RAW-OCR-DO-NOT-PERSIST',
  'PRIVACY-EXPORTED-FIELDS-DO-NOT-PERSIST',
];

const importedProfile = {
  schemaVersion: 1,
  templates: [
    {
      schemaVersion: 1,
      id: 'imported_profile_001',
      name: 'Imported profile',
      seller: { nameKey: 'Imported Traders' },
      fieldMappings: [],
      tableColumns: [],
      createdAt: '2026-11-07T00:00:00.000Z',
      updatedAt: '2026-11-07T00:00:00.000Z',
    },
  ],
};

test('seller profile consent, save, export, import, reload and delete do not persist invoice data', async ({
  page,
}) => {
  const observedRequests: { url: string; body: string | null }[] = [];
  page.on('request', (request) => {
    observedRequests.push({ url: request.url(), body: request.postData() });
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seller matching profiles' })).toBeVisible();

  const consent = page.getByLabel(
    'I explicitly agree to save or import these seller matching profiles in this browser.',
  );
  const save = page.getByRole('button', { name: 'Save profile' });
  const importButton = page.getByRole('button', { name: 'Import' });
  await expect(save).toBeDisabled();
  await expect(importButton).toBeDisabled();

  await page.getByLabel('Profile name').fill('Greenfield profile');
  await page.getByLabel('Seller name key').fill('Greenfield Traders');
  await consent.check();
  await save.click();
  await expect(page.getByText('Seller matching profile saved in this browser.')).toBeVisible();

  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(saved).toContain('Greenfield Traders');
  expect(saved).toContain('Greenfield profile');
  for (const marker of privacyMarkers) expect(saved).not.toContain(marker);

  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const exported = await exportEvent;
  const exportedPath = await exported.path();
  if (!exportedPath) throw new Error('Playwright did not expose the seller-profile export.');
  const exportedText = await readFile(exportedPath, 'utf8');
  expect(exportedText).toContain('Greenfield Traders');
  for (const marker of privacyMarkers) expect(exportedText).not.toContain(marker);

  await consent.check();
  await page.setInputFiles('input[accept="application/json"]', {
    name: 'imported-profile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedProfile)),
  });
  await expect(page.getByText('1 seller profile imported.')).toBeVisible();
  await expect(
    page.locator('.dx-template-list li').filter({ hasText: 'Imported profile' }),
  ).toBeVisible();

  const afterImport = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(afterImport).toContain('Imported Traders');
  expect(afterImport).toContain('Greenfield Traders');
  for (const marker of privacyMarkers) expect(afterImport).not.toContain(marker);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
  await expect(
    page.locator('.dx-template-list li').filter({ hasText: 'Greenfield profile' }),
  ).toBeVisible();
  await expect(
    page.locator('.dx-template-list li').filter({ hasText: 'Imported profile' }),
  ).toBeVisible();

  await page
    .locator('.dx-template-list li')
    .filter({ hasText: 'Imported profile' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await page
    .locator('.dx-template-list li')
    .filter({ hasText: 'Greenfield profile' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('.dx-template-list li')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
  const remaining = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(remaining).toContain('"templates": []');
  for (const marker of privacyMarkers) expect(remaining).not.toContain(marker);

  const storage = await page.evaluate(async (markers) => {
    const cacheNames = await caches.keys();
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

    return {
      cacheMarkerMatches,
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
  }, privacyMarkers);

  expect(storage.cacheMarkerMatches).toEqual([]);
  expect(storage.databases.filter(Boolean)).toEqual([]);
  const appOrigin = new URL(page.url()).origin;
  expect(observedRequests.every((request) => new URL(request.url).origin === appOrigin)).toBe(true);
  const persisted = JSON.stringify(storage);
  for (const marker of privacyMarkers) {
    expect(persisted).not.toContain(marker);
    expect(JSON.stringify(observedRequests)).not.toContain(marker);
  }
});
