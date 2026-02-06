/**
 * Facebook Marketplace Integration Service
 * Uses facebookAuthManager for all auth (session-first, Key Vault fallback).
 * No direct credential handling.
 */

import { chromium, Browser, Page } from "playwright";
import { storage } from "./storage";
import {
  getAuthenticatedContext,
  saveStorageStateAfterConnect,
  clearStorageState,
  markNeedsReconnect,
} from "./facebookAuthManager";

/**
 * Connect to Facebook Marketplace (initial setup).
 * User provides email/password; we perform hard login, save storageState to DB, and store creds in Key Vault (via route).
 */
export async function connectFacebookMarketplace(
  orgId: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; accountIdentifier?: string }> {
  let browser: Browser | null = null;

  try {
    console.log("[Facebook Marketplace Connect] Starting connection for org", orgId);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    await page.goto("https://www.facebook.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="pass"]', password);
    await page.click('button[name="login"]');

    try {
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 15000 });
    } catch {
      /* ok */
    }

    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/checkpoint")) {
      const error = currentUrl.includes("/checkpoint")
        ? "Login requires verification (CAPTCHA or 2FA). Please complete verification in browser first."
        : "Login failed. Please check your credentials.";
      console.error("[Facebook Marketplace Connect]", error);
      await browser.close();
      await updateIntegrationStatus(orgId, {
        connected: false,
        lastError: error,
        lastVerifiedAt: new Date().toISOString(),
      });
      return { success: false, error };
    }

    await page.goto("https://www.facebook.com/marketplace/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    if (page.url().includes("/login")) {
      await browser.close();
      await updateIntegrationStatus(orgId, {
        connected: false,
        lastError: "Could not access Marketplace. Session may have expired.",
        lastVerifiedAt: new Date().toISOString(),
      });
      return { success: false, error: "Could not access Marketplace. Session may have expired." };
    }

    const state = await context.storageState();
    try {
      await saveStorageStateAfterConnect(orgId, state as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await browser.close();
      await updateIntegrationStatus(orgId, {
        connected: false,
        lastError: `Failed to save session: ${msg}. Ensure ENCRYPTION_KEY is set (min 32 chars).`,
        lastVerifiedAt: new Date().toISOString(),
      });
      return {
        success: false,
        error: "Session could not be saved. Please configure ENCRYPTION_KEY environment variable.",
      };
    }

    let accountIdentifier = email;
    try {
      const nameElement = await page.$('[aria-label="Account"] span');
      if (nameElement) {
        const name = await nameElement.textContent();
        if (name) accountIdentifier = name.trim();
      }
    } catch {
      /* ignore */
    }

    await browser.close();

    await updateIntegrationStatus(orgId, {
      connected: true,
      accountIdentifier,
      lastError: null,
      lastVerifiedAt: new Date().toISOString(),
    });

    console.log("[Facebook Marketplace Connect] Successfully connected for org", orgId);
    return { success: true, accountIdentifier };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Facebook Marketplace Connect] Error:", msg);

    if (browser) await browser.close();

    await updateIntegrationStatus(orgId, {
      connected: false,
      lastError: msg,
      lastVerifiedAt: new Date().toISOString(),
    });

    return { success: false, error: msg };
  }
}

/**
 * Verify Facebook Marketplace session using auth manager (session-first, Key Vault fallback).
 */
export async function verifyFacebookMarketplace(orgId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[Facebook Marketplace Verify] Verifying session for org", orgId);

    const auth = await getAuthenticatedContext(orgId);
    if (!auth) {
      const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);
      const cfg = (config?.config as Record<string, unknown>) || {};
      const err =
        (cfg.lastError as string) ||
        "No saved session and Key Vault fallback failed. Please reconnect.";
      await updateIntegrationStatus(orgId, {
        connected: false,
        lastError: err,
        lastVerifiedAt: new Date().toISOString(),
      });
      return { success: false, error: err };
    }

    await auth.context.close();
    await auth.browser.close();

    await updateIntegrationStatus(orgId, {
      connected: true,
      lastError: null,
      lastVerifiedAt: new Date().toISOString(),
    });

    console.log("[Facebook Marketplace Verify] Session valid for org", orgId);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Facebook Marketplace Verify] Error:", msg);
    await updateIntegrationStatus(orgId, {
      connected: false,
      lastError: msg,
      lastVerifiedAt: new Date().toISOString(),
    });
    return { success: false, error: msg };
  }
}

/**
 * Disconnect Facebook Marketplace. Clears storageState from DB.
 */
export async function disconnectFacebookMarketplace(orgId: string): Promise<void> {
  console.log("[Facebook Marketplace Disconnect] Disconnecting for org", orgId);
  await clearStorageState(orgId);
  await updateIntegrationStatus(orgId, {
    connected: false,
    accountIdentifier: null,
    lastError: null,
    lastVerifiedAt: new Date().toISOString(),
  });
  console.log("[Facebook Marketplace Disconnect] Disconnected for org", orgId);
}

/**
 * Get an authenticated context for Facebook operations. Use for in-process Playwright flows.
 * Caller must close browser and context when done.
 */
export async function getAuthenticatedContextForFlow(orgId: string) {
  return getAuthenticatedContext(orgId);
}

export { markNeedsReconnect };

/**
 * Get Facebook Marketplace integration status.
 */
export async function getFacebookMarketplaceStatus(orgId: string): Promise<{
  connected: boolean;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  accountIdentifier?: string | null;
}> {
  try {
    const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);

    if (!config || !config.isActive) {
      return { connected: false };
    }

    const marketplaceConfig = config.config as Record<string, unknown>;

    return {
      connected: marketplaceConfig?.connected === true,
      lastVerifiedAt: (marketplaceConfig?.lastVerifiedAt as string) ?? null,
      lastError: (marketplaceConfig?.lastError as string) ?? null,
      accountIdentifier: (marketplaceConfig?.accountIdentifier as string) ?? null,
    };
  } catch (error) {
    console.error("[Facebook Marketplace Status] Error:", error);
    return { connected: false };
  }
}

async function updateIntegrationStatus(
  orgId: string,
  status: {
    connected: boolean;
    accountIdentifier?: string | null;
    lastError?: string | null;
    lastVerifiedAt: string;
  }
): Promise<void> {
  try {
    const existingConfig = await storage.getIntegrationConfig("facebook-marketplace", orgId);

    const newConfig = {
      ...((existingConfig?.config as Record<string, unknown>) || {}),
      ...status,
    };

    await storage.upsertIntegrationConfig({
      service: "facebook-marketplace",
      orgId,
      config: newConfig,
      isActive: status.connected,
    });
  } catch (error) {
    console.error("[Facebook Marketplace] Failed to update status:", error);
    throw error;
  }
}
