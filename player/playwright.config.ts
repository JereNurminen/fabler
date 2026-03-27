import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5199",
  },
  webServer: {
    command: "npx vite --config e2e/test-app/vite.config.ts",
    port: 5199,
    reuseExistingServer: !process.env.CI,
  },
});
