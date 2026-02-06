/**
 * Centralized Facebook auth: session-first (storageState), fallback to Key Vault hard login.
 * DB stores only encrypted storageState; never plaintext credentials.
 */

import { chromium, Browser, BrowserContext } from "playwright";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";
import { promises as fs } from "fs";
import { resolve } from "path";
import { storage } from "./storage";
import { getFacebookCredentialsForOrg } from "./facebookAuthSecrets.service";
import * as keyVault from "./keyVault";

const FB_LOGIN_URL = "https://www.facebook.com/login";
const FB_MARKETPLACE_URL = "https://www.facebook.com/marketplace/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

/** Redact potential secrets from log strings. Never log actual secrets. */
export function redact(str: string): string {
  if (!str || str.length < 4) return "***";
  return str.substring(0, 2) + "***" + str.substring(str.length - 2);
}

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error("ENCRYPTION_KEY env must be set (min 32 chars) for storageState encryption");
  }
  const buf = Buffer.from(ENCRYPTION_KEY, "utf8");
  if (buf.length >= KEY_LEN) return buf.subarray(0, KEY_LEN);
  return scryptSync(ENCRYPTION_KEY, "lead2lease-fb-salt", KEY_LEN);
}

function encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(encrypted: { ciphertext: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return decipher.update(encrypted.ciphertext, "base64", "utf8") + decipher.final("utf8");
}

function isEncryptionConfigured(): boolean {
  return !!(ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 16);
}

async function loadStorageStateFromDb(orgId: string): Promise<Record<string, unknown> | null> {
  const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);
  const cfg = config?.config as Record<string, unknown> | undefined;
  const enc = cfg?.storageStateEncrypted as { ciphertext?: string; iv?: string; tag?: string } | undefined;
  if (!enc?.ciphertext || !enc?.iv || !enc?.tag) return null;
  if (!isEncryptionConfigured()) {
    console.warn("[Facebook Auth] ENCRYPTION_KEY not set, cannot decrypt storageState");
    return null;
  }
  try {
    const json = decrypt({ ciphertext: enc.ciphertext, iv: enc.iv, tag: enc.tag });
    return JSON.parse(json) as Record<string, unknown>;
  } catch (err) {
    console.error("[Facebook Auth] Failed to decrypt storageState for org", orgId, err instanceof Error ? err.message : err);
    return null;
  }
}

async function saveStorageStateToDb(orgId: string, state: Record<string, unknown>): Promise<void> {
  if (!isEncryptionConfigured()) {
    throw new Error("ENCRYPTION_KEY required to save storageState");
  }
  const encrypted = encrypt(JSON.stringify(state));
  const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);
  const existing = (config?.config as Record<string, unknown>) || {};
  await storage.upsertIntegrationConfig({
    service: "facebook-marketplace",
    orgId,
    config: { ...existing, storageStateEncrypted: encrypted },
    isActive: config?.isActive ?? true,
  });
}

async function validateSession(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(FB_MARKETPLACE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    if (url.includes("/login")) return false;
    const hasLogin = (await page.locator('text="Log in"').count()) > 0;
    return !hasLogin;
  } finally {
    await page.close();
  }
}

async function performHardLogin(
  orgId: string,
  email: string,
  password: string,
  browser: Browser
): Promise<{ context: BrowserContext; accountIdentifier: string } | null> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  try {
    await page.goto(FB_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="pass"]', password);
    await page.click('button[name="login"]');
    try {
      await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 15000 });
    } catch {
      /* ok */
    }
    const url = page.url();
    if (url.includes("/login") || url.includes("/checkpoint")) return null;
    await page.goto(FB_MARKETPLACE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) return null;
    let accountIdentifier = email;
    try {
      const el = await page.$('[aria-label="Account"] span');
      if (el) {
        const t = await el.textContent();
        if (t) accountIdentifier = t.trim();
      }
    } catch {
      /* ignore */
    }
    return { context, accountIdentifier };
  } catch {
    await context.close();
    return null;
  }
}

/** Mark connection as needing reconnect; stop automated flows. */
export async function markNeedsReconnect(orgId: string, reason: string): Promise<void> {
  const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);
  const existing = (config?.config as Record<string, unknown>) || {};
  await storage.upsertIntegrationConfig({
    service: "facebook-marketplace",
    orgId,
    config: {
      ...existing,
      connected: false,
      needsReconnect: true,
      lastError: reason,
      lastVerifiedAt: new Date().toISOString(),
    },
    isActive: false,
  });
  console.log("[Facebook Auth] Marked needs_reconnect for org", orgId, "reason:", reason);
}

/** Fallback: fetch creds from Key Vault, hard login, save storageState to DB. Returns true on success. */
async function fallbackLogin(orgId: string): Promise<boolean> {
  if (!keyVault.isKeyVaultConfigured()) {
    console.log("[Facebook Auth] StorageState invalid -> Key Vault not configured, cannot fallback");
    await markNeedsReconnect(orgId, "Key Vault not configured. Please reconnect.");
    return false;
  }
  console.log("[Facebook Auth] StorageState invalid -> falling back to Key Vault hard login");
  const creds = await getFacebookCredentialsForOrg(orgId, "facebook-fallback-login");
  if (!creds) {
    console.log("[Facebook Auth] Key Vault missing secrets for org", orgId);
    await markNeedsReconnect(orgId, "Credentials missing in Key Vault. Please reconnect.");
    return false;
  }
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const result = await performHardLogin(orgId, creds.email, creds.password, browser);
    if (!result) {
      await markNeedsReconnect(orgId, "Hard login failed (invalid creds or 2FA). Please reconnect.");
      return false;
    }
    const state = await result.context.storageState();
    await result.context.close();
    await browser.close();
    browser = null;
    await saveStorageStateToDb(orgId, state as Record<string, unknown>);
    console.log("[Facebook Auth] Hard login success -> refreshed storageState");
    return true;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Get an authenticated browser context. Session-first, then Key Vault fallback.
 * Caller must close the returned context and browser when done.
 */
export async function getAuthenticatedContext(
  orgId: string,
  requestId?: string
): Promise<{ browser: Browser; context: BrowserContext } | null> {
  const rid = requestId || "fb-" + Date.now();
  const state = await loadStorageStateFromDb(orgId);
  if (state) {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        storageState: state,
        viewport: { width: 1280, height: 720 },
        userAgent: USER_AGENT,
      });
      const valid = await validateSession(context);
      if (valid) {
        console.log("[Facebook Auth] Using storageState auth", rid, "org", orgId);
        return { browser, context };
      }
      await context.close();
      await browser.close();
    } catch (err) {
      console.warn("[Facebook Auth] storageState load/validate failed", rid, err instanceof Error ? err.message : err);
    }
  }
  const ok = await fallbackLogin(orgId);
  if (!ok) return null;
  const state2 = await loadStorageStateFromDb(orgId);
  if (!state2) return null;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: state2,
    viewport: { width: 1280, height: 720 },
    userAgent: USER_AGENT,
  });
  return { browser, context };
}

/**
 * Ensure auth, write storageState to temp file for spawned Playwright processes.
 * Returns path. Caller must delete the file when done (or use a cleanup callback).
 *
 * Strategic: Do NOT validate session here. Validation pokes Facebook with headless,
 * then 1s later the headed test pokes again — Facebook sees two devices and may kick the session.
 * Trust the DB: write state to temp file and spawn. The test handles login detection and fallback.
 */
export async function getStorageStatePathForSpawnedProcess(
  orgId: string
): Promise<{ path: string; cleanup: () => Promise<void> } | null> {
  const state = await loadStorageStateFromDb(orgId);
  if (state) {
    const tmpDir = resolve(process.cwd(), "data", "facebook", "temp");
    await fs.mkdir(tmpDir, { recursive: true });
    const path = resolve(tmpDir, `storage-${orgId}-${Date.now()}.json`);
    await fs.writeFile(path, JSON.stringify(state), "utf8");
    console.log("[Facebook Auth] Wrote storageState to temp file for spawned process org", orgId, "(no validation - test handles login)");
    return {
      path,
      cleanup: async () => {
        try {
          await fs.unlink(path);
        } catch {
          /* ignore */
        }
      },
    };
  }
  const ok = await fallbackLogin(orgId);
  if (!ok) return null;
  const state2 = await loadStorageStateFromDb(orgId);
  if (!state2) return null;
  const tmpDir = resolve(process.cwd(), "data", "facebook", "temp");
  await fs.mkdir(tmpDir, { recursive: true });
  const path = resolve(tmpDir, `storage-${orgId}-${Date.now()}.json`);
  await fs.writeFile(path, JSON.stringify(state2), "utf8");
  console.log("[Facebook Auth] Using Key Vault fallback auth (hard login) for spawned process org", orgId);
  return {
    path,
    cleanup: async () => {
      try {
        await fs.unlink(path);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Save storageState to DB (used after initial connect flow). */
export async function saveStorageStateAfterConnect(
  orgId: string,
  state: Record<string, unknown>
): Promise<void> {
  await saveStorageStateToDb(orgId, state);
}

/** Clear storageState from DB (on disconnect). */
export async function clearStorageState(orgId: string): Promise<void> {
  const config = await storage.getIntegrationConfig("facebook-marketplace", orgId);
  const existing = (config?.config as Record<string, unknown>) || {};
  const { storageStateEncrypted, ...rest } = existing;
  await storage.upsertIntegrationConfig({
    service: "facebook-marketplace",
    orgId,
    config: rest,
    isActive: existing.isActive !== false,
  });
  console.log("[Facebook Auth] Cleared storageState for org", orgId);
}
