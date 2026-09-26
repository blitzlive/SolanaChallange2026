import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { baseURL: 'http://localhost:5175', channel: 'msedge', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start', url: 'http://localhost:5175', reuseExistingServer: false,
    env: { PORT: '5175', HOST: '127.0.0.1', APP_ORIGIN: 'http://localhost:5175', PAYMENT_MODE: 'demo', DATA_DIR: `.data/e2e-${Date.now()}` },
  },
});
