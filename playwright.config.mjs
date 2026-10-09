// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from "@playwright/test";
const external = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.SYNOMIZER_TEST_PORT || 4186);
export default defineConfig({
  testDir: "./tests/web",
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: external || `http://127.0.0.1:${port}/Synomizer/`, trace: "retain-on-failure", screenshot: "only-on-failure", actionTimeout: 10000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: external ? undefined : {
    command: "npm run build:site && npm run serve",
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/Synomizer/`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
