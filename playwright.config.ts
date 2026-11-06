import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173/DocuExtract/', trace: 'on-first-retry' },
  webServer: {
    command: 'node scripts/prepare-pwa-test-builds.mjs && node scripts/pwa-test-server.mjs',
    url: 'http://127.0.0.1:4173/DocuExtract/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
