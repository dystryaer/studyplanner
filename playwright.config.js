import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:demo -- --memory --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 60000 },
});
