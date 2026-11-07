import { expect, test } from '@playwright/test';

async function openApp(page: import('@playwright/test').Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel', level: 1 })).toBeVisible();
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`upload action is visible without scrolling at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page);

    const dropZone = page.locator('.dx-drop__zone');
    const choose = page.getByRole('button', { name: 'Choose PDFs' });
    await expect(dropZone).toBeVisible();
    await expect(choose).toBeVisible();

    const buttonBox = await choose.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(viewport.height);
    const readingOptions = page.locator('details.dx-locale-panel');
    await expect(readingOptions.locator('summary')).toHaveText('Reading options');
    await expect(readingOptions).not.toHaveAttribute('open');
  });
}

test('reading options remain keyboard operable and locale is independent from OCR language', async ({
  page,
}) => {
  await openApp(page);
  const summary = page.getByText('Reading options', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');

  const locale = page.getByLabel('Invoice locale');
  const language = page.getByLabel('Scanned PDF language');
  await expect(locale).toBeVisible();
  await expect(language).toBeVisible();
  await locale.selectOption('de-DE');
  await expect(locale).toHaveValue('de-DE');
  await page.route('**/ocr/lang/hin.traineddata*', (route) =>
    route.fulfill({ status: 503, body: 'offline test response' }),
  );
  await language.selectOption('hin');
  await expect(language).toHaveValue('hin');
  await expect(locale).toHaveValue('de-DE');
});

test('page containers do not overflow at desktop and mobile sizes in light and dark schemes', async ({
  page,
}) => {
  await openApp(page);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      for (const selector of ['.dx-header', '.dx-hero', '.dx-drop', '.dx-footer']) {
        const element = page.locator(selector).first();
        await expect(element).toBeVisible();
        const bounds = await element.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  }
});

test('PWA status has separated text, stays inside the page container and can be dismissed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  const banner = page.locator('.dx-pwa').first();
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(banner).toHaveAttribute('role', 'status');
  await expect(banner).toHaveAttribute('aria-live', 'polite');

  await page.emulateMedia({ colorScheme: 'light' });
  const lightBackground = await banner.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBackground = await banner.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(darkBackground).not.toBe(lightBackground);

  const title = banner.locator('.dx-pwa__title');
  const detail = banner.locator('.dx-pwa__detail');
  await expect(title).toBeVisible();
  await expect(detail).toBeVisible();
  expect(await title.innerText()).not.toBe(await detail.innerText());
  const container = page.locator('.dx-pwa-slot').first();
  const bannerBox = await banner.boundingBox();
  const containerBox = await container.boundingBox();
  expect(bannerBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(bannerBox!.x).toBeGreaterThanOrEqual(containerBox!.x);
  expect(bannerBox!.x + bannerBox!.width).toBeLessThanOrEqual(
    containerBox!.x + containerBox!.width,
  );

  await banner.getByRole('button', { name: 'Dismiss offline status' }).focus();
  await page.keyboard.press('Enter');
  await expect(banner).toHaveCount(0);
});

test('PWA banner reflects browser offline and online transitions', async ({ page, context }) => {
  await openApp(page);
  const banner = page.locator('.dx-pwa').first();
  await expect(banner).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await expect(banner.locator('.dx-pwa__title')).toHaveText('Offline mode');
  await context.setOffline(false);
  await expect(banner.locator('.dx-pwa__title')).not.toHaveText('Offline mode');
});
