import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

const pdf = async (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(await generateFixture('basic')),
});

async function waitForController(page: Page) {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
    }
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(page.getByRole('heading', { name: /PDF Invoice to Excel/i })).toBeVisible({
    timeout: 30_000,
  });
  const pageBuildId = await page
    .locator('meta[name="docuextract-build-id"]')
    .getAttribute('content');
  expect(pageBuildId).toBe(await activeBuildId(page));
}

async function activeBuildId(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(
          () => reject(new Error('Service worker did not report its build ID.')),
          5_000,
        );
        channel.port1.onmessage = (event: MessageEvent<{ buildId: string }>) => {
          window.clearTimeout(timeout);
          resolve(event.data.buildId);
        };
        navigator.serviceWorker.controller?.postMessage({ type: 'DOCUEXTRACT_GET_BUILD_ID' }, [
          channel.port2,
        ]);
      }),
  );
}

async function pageBuildId(page: Page): Promise<string> {
  const buildId = await page.locator('meta[name="docuextract-build-id"]').getAttribute('content');
  if (!buildId) throw new Error('The app page did not expose its build ID.');
  return buildId;
}

async function reloadIntoBuild(page: Page, buildId: string) {
  await page.reload();
  await expect.poll(() => pageBuildId(page), { timeout: 30_000 }).toBe(buildId);
}

async function switchBuild(build: 'old' | 'new' | 'failed' | 'retry') {
  const response = await fetch(`http://127.0.0.1:4173/__pwa_test__/switch/${build}`, {
    method: 'POST',
  });
  expect(response.status).toBe(204);
}

test.beforeEach(async () => {
  await switchBuild('old');
});

test.afterEach(async () => {
  await switchBuild('old');
});

test('defers and accepts a real two-build update, preserves an old tab, and recovers from a failed install', async ({
  page,
  context,
}) => {
  await waitForController(page);
  const oldBuildId = await activeBuildId(page);
  expect(await pageBuildId(page)).toBe(oldBuildId);

  const secondTab = await context.newPage();
  await waitForController(secondTab);
  expect(await pageBuildId(secondTab)).toBe(oldBuildId);
  await secondTab.setInputFiles('input[type="file"]', await pdf('multi-tab-offline.pdf'));
  await expect(secondTab.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(secondTab.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');

  await switchBuild('new');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.ready).waiting),
    undefined,
    { timeout: 60_000 },
  );
  await expect(
    page.locator('.dx-pwa:visible').getByText('Update available', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Later' }).click();
  await expect(
    page
      .locator('.dx-pwa:visible')
      .getByText('Update deferred. Your current tab will not reload automatically.'),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)),
  ).toBe(true);
  expect(await activeBuildId(page)).toBe(oldBuildId);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Update now' })).toBeVisible();
  await page.getByRole('button', { name: 'Update now' }).click();
  await page.waitForFunction(
    async (previousBuildId) => {
      const controller = navigator.serviceWorker.controller;
      if (!controller) return false;
      return new Promise<boolean>((resolve) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(() => resolve(false), 2_000);
        channel.port1.onmessage = (event: MessageEvent<{ buildId: string }>) => {
          window.clearTimeout(timeout);
          resolve(event.data.buildId !== previousBuildId);
        };
        controller.postMessage({ type: 'DOCUEXTRACT_GET_BUILD_ID' }, [channel.port2]);
      });
    },
    oldBuildId,
    { timeout: 60_000 },
  );
  const newBuildId = await activeBuildId(page);
  expect(newBuildId).not.toBe(oldBuildId);

  await reloadIntoBuild(page, newBuildId);
  expect(await pageBuildId(secondTab)).toBe(oldBuildId);
  await expect(secondTab.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');

  // ExcelJS is a lazy chunk. The old page asks for its old hashed URL after
  // the new worker has claimed the tab; the old shell cache must still serve it.
  const xlsxEvent = secondTab.waitForEvent('download');
  await secondTab.getByRole('button', { name: 'Download Excel' }).click();
  const xlsxDownload = await xlsxEvent;
  expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/);

  await switchBuild('failed');
  const failedInstall = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise<boolean>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('Timed out waiting for failed service-worker installation.')),
        60_000,
      );
      registration.addEventListener(
        'updatefound',
        () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'redundant') {
              window.clearTimeout(timeout);
              resolve(true);
            }
          });
        },
        { once: true },
      );
      registration.update().catch(reject);
    });
  });
  expect(failedInstall).toBe(true);
  expect(await activeBuildId(page)).toBe(newBuildId);

  const failedManifest = JSON.parse(
    await readFile(resolve('.pwa-test-builds/failed/precache-manifest.json'), 'utf8'),
  ) as { buildId: string };
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).not.toContain(`docuextract-${failedManifest.buildId}-shell`);

  // Keep the test origin on the known-good build before reloading.
  await switchBuild('new');
  await reloadIntoBuild(page, newBuildId);
  await expect(page.getByRole('heading', { name: /PDF Invoice to Excel/i })).toBeVisible();
  await expect(secondTab.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');

  await switchBuild('retry');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.ready).waiting),
    undefined,
    { timeout: 60_000 },
  );
  await expect(
    page.locator('.dx-pwa:visible').getByText('Update available', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Update now' }).click();
  // Controller change can race the message-port build-ID probe. A reload is the
  // user-visible acceptance boundary, so assert the new page and worker agree.
  await page.reload();
  await expect.poll(() => pageBuildId(page), { timeout: 30_000 }).not.toBe(newBuildId);
  const retryBuildId = await pageBuildId(page);
  expect(await activeBuildId(page)).toBe(retryBuildId);
  await expect(page.getByRole('heading', { name: /PDF Invoice to Excel/i })).toBeVisible();
  expect(await pageBuildId(secondTab)).toBe(oldBuildId);
  await expect(secondTab.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');

  const shellCachesBeforeCleanup = await page.evaluate(() =>
    caches.keys().then((names) => names.filter((name) => name.endsWith('-shell'))),
  );
  expect(shellCachesBeforeCleanup).toContain(`docuextract-${oldBuildId}-shell`);
  expect(shellCachesBeforeCleanup).not.toContain(`docuextract-${newBuildId}-shell`);

  await secondTab.close();
  // Reloading fires the app's normal pageshow cleanup trigger; no manual
  // service-worker cleanup message is sent by the test.
  await page.reload();
  await expect(page.getByRole('heading', { name: /PDF Invoice to Excel/i })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        caches.keys().then((names) => names.filter((name) => name.startsWith('docuextract-'))),
      ),
    )
    .toEqual([`docuextract-${retryBuildId}-shell`]);
});

test('a quota-exceeded update preserves the last working shell and active worker', async ({
  page,
  context,
}) => {
  await waitForController(page);
  const workingBuildId = await activeBuildId(page);
  const origin = new URL(page.url()).origin;
  const session = await context.newCDPSession(page);

  try {
    const { usage } = await session.send('Storage.getUsageAndQuota', { origin });
    expect(usage).toBeGreaterThan(0);
    // Constrain real Chromium storage to its current usage. Installing a second
    // versioned shell must hit the browser's actual Cache Storage quota.
    await session.send('Storage.overrideQuotaForOrigin', {
      origin,
      quotaSize: usage,
    });

    const quotaProbeError = await page.evaluate(async () => {
      const cacheName = 'docuextract-quota-probe';
      try {
        const cache = await caches.open(cacheName);
        await cache.put(
          new Request(`${location.origin}/__quota_probe__`),
          new Response(new Uint8Array(1024 * 1024)),
        );
        return null;
      } catch (error) {
        return error instanceof DOMException ? error.name : String(error);
      } finally {
        await caches.delete(cacheName);
      }
    });
    expect(quotaProbeError).toBe('QuotaExceededError');

    await switchBuild('quota');

    const failedInstall = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return new Promise<boolean>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error('Timed out waiting for quota-limited installation.')),
          60_000,
        );
        registration.addEventListener(
          'updatefound',
          () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'redundant') {
                window.clearTimeout(timeout);
                resolve(true);
              }
            });
          },
          { once: true },
        );
        registration.update().catch(reject);
      });
    });
    expect(failedInstall).toBe(true);
    expect(await activeBuildId(page)).toBe(workingBuildId);

    const quotaManifest = JSON.parse(
      await readFile(resolve('.pwa-test-builds/quota/precache-manifest.json'), 'utf8'),
    ) as { buildId: string };
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toContain(`docuextract-${workingBuildId}-shell`);
    expect(cacheNames).not.toContain(`docuextract-${quotaManifest.buildId}-shell`);

    await page.reload();
    await expect(page.getByRole('heading', { name: /PDF Invoice to Excel/i })).toBeVisible();
    expect(await activeBuildId(page)).toBe(workingBuildId);
    await page.setInputFiles('input[type="file"]', await pdf('quota-recovery.pdf'));
    await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');
  } finally {
    await session
      .send('Storage.overrideQuotaForOrigin', {
        origin,
        quotaSize: 256 * 1024 * 1024,
      })
      .catch(() => undefined);
    await session.detach();
  }
});
