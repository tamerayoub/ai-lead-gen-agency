import { chromium } from "@playwright/test";
import fs from "fs";

const storagePath = "playwright/.auth/facebook.json";

export default async function globalSetup() {
  const email = process.env.PLAYWRIGHT_FB_EMAIL;
  const password = process.env.PLAYWRIGHT_FB_PASSWORD;

  if (!email || !password) {
    console.warn(
      "[playwright] Skipping Facebook login: set PLAYWRIGHT_FB_EMAIL and PLAYWRIGHT_FB_PASSWORD"
    );
    return;
  }

  fs.mkdirSync("playwright/.auth", { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.facebook.com/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="pass"]', password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("login"), {
      timeout: 30_000,
    }),
    page.click('button[name="login"]'),
  ]);

  await context.storageState({ path: storagePath });
  await browser.close();
}








