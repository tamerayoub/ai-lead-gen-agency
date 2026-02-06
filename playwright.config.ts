import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Match facebookAuthManager: same viewport/userAgent so Facebook accepts session cookies
const FB_SESSION_VIEWPORT = { width: 1280, height: 720 };
const FB_SESSION_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  globalSetup: "./tests/global-setup/facebook-login.ts",
  // Start dev server automatically before tests (only if not already running)
  // Skip if PLAYWRIGHT_SKIP_WEBSERVER is set (e.g., when server is already running)
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER !== 'true' ? {
    webServer: {
      command: process.platform === 'win32' 
        ? "npm run dev:cursor"
        : "npm run dev",
      url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5000",
      reuseExistingServer: !process.env.CI, // Reuse existing server if available
      timeout: 120000,
      stdout: "ignore",
      stderr: "pipe",
    },
  } : {}),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    ...(process.env.PLAYWRIGHT_STORAGE_STATE_PATH && {
      storageState: path.resolve(process.env.PLAYWRIGHT_STORAGE_STATE_PATH),
      viewport: FB_SESSION_VIEWPORT,
      userAgent: FB_SESSION_USER_AGENT,
    }),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});

