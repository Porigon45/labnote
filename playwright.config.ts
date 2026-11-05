import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 15_000 },
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:migrate && npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      LABNOTE_E2E: "1",
      LABNOTE_DATA_DIR: resolve("test-results/storage/data"),
      LABNOTE_ATTACHMENTS_DIR: resolve("test-results/storage/attachments"),
      LABNOTE_BACKUP_DIR: resolve("test-results/storage/backups"),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
