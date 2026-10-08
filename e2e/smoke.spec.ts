import { test, expect } from '@playwright/test';
import { generateFixture } from '../src/tests/fixtures/generateFixtures';

test('upload screen loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PDF Invoice to Excel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose PDF' })).toBeVisible();
});

test('uploads a PDF and reaches the review screen with extracted fields', async ({ page }) => {
  await page.goto('/');

  const buffer = Buffer.from(await generateFixture('basic'));
  await page.setInputFiles('input[type="file"]', {
    name: 'basic.pdf',
    mimeType: 'application/pdf',
    buffer,
  });

  await expect(page.getByRole('heading', { name: 'Review extracted fields' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel('Invoice number')).toHaveValue('INV-BASIC-001');
  await expect(page.getByLabel('Grand total')).toHaveValue('1180');
});

test('shows a clear error for a corrupt PDF and stays usable', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type="file"]', {
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is not a pdf'),
  });

  await expect(page.getByRole('alert')).toContainText('could not be opened', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Choose PDF' })).toBeVisible();
});
