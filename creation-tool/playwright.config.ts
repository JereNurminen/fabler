import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // `fullyParallel: false` and `workers: 1` are required, not just a
  // performance choice: the Rust test server (`test_server.rs`) writes
  // bundle exports to a single fixed temp path, which is only safe if no
  // two tests can export concurrently.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60000,

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'VITE_USE_HTTP_API=true VITE_API_URL=http://127.0.0.1:3001/api npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
