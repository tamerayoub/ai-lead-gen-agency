/**
 * Facebook auth secrets: store and retrieve credentials via Azure Key Vault.
 * Database holds only secret names (references). No plaintext in DB or API responses.
 * Secrets are decrypted in-memory only and must be zeroed after use (e.g. before Playwright login returns).
 */

import { db } from "./db";
import { externalAuthSecrets, externalAuthSecretAudit } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as keyVault from "./keyVault";

const PROVIDER = "facebook";
const EMAIL_KIND = "email";
const PASSWORD_KIND = "password";

function secretNameEmail(orgId: string, userId: string): string {
  return `facebook-email-${orgId}-${userId}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

function secretNamePassword(orgId: string, userId: string): string {
  return `facebook-password-${orgId}-${userId}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

/**
 * Store Facebook credentials in Key Vault and save only secret references in DB.
 * No plaintext is stored in the database.
 */
export async function storeFacebookCredentials(
  userId: string,
  orgId: string,
  email: string,
  password: string
): Promise<void> {
  if (!keyVault.isKeyVaultConfigured()) {
    throw new Error("Key Vault is not configured (KEY_VAULT_URI)");
  }
  const emailSecretName = secretNameEmail(orgId, userId);
  const passwordSecretName = secretNamePassword(orgId, userId);

  await keyVault.setSecret(emailSecretName, email);
  await keyVault.setSecret(passwordSecretName, password);

  const now = new Date();
  for (const kind of [EMAIL_KIND, PASSWORD_KIND]) {
    const secretName = kind === EMAIL_KIND ? emailSecretName : passwordSecretName;
    const existing = await db
      .select()
      .from(externalAuthSecrets)
      .where(
        and(
          eq(externalAuthSecrets.orgId, orgId),
          eq(externalAuthSecrets.userId, userId),
          eq(externalAuthSecrets.provider, PROVIDER),
          eq(externalAuthSecrets.credentialKind, kind)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(externalAuthSecrets)
        .set({
          secretName,
          rotatedAt: now,
          lastUsedAt: null,
        })
        .where(eq(externalAuthSecrets.id, existing[0].id));
    } else {
      await db.insert(externalAuthSecrets).values({
        orgId,
        userId,
        provider: PROVIDER,
        credentialKind: kind,
        secretName,
      });
    }
  }
}

/**
 * Retrieve Facebook credentials from Key Vault. For use only in backend (e.g. Playwright login).
 * Caller must zero out the returned strings after use. Never return to UI or API responses.
 * Logs access for audit (no secret values in logs).
 */
export async function getFacebookCredentials(
  userId: string,
  orgId: string,
  reason: string
): Promise<{ email: string; password: string } | null> {
  if (!keyVault.isKeyVaultConfigured()) {
    return null;
  }
  const rows = await db
    .select()
    .from(externalAuthSecrets)
    .where(
      and(
        eq(externalAuthSecrets.orgId, orgId),
        eq(externalAuthSecrets.userId, userId),
        eq(externalAuthSecrets.provider, PROVIDER)
      )
    );
  const emailRow = rows.find((r) => r.credentialKind === EMAIL_KIND);
  const passwordRow = rows.find((r) => r.credentialKind === PASSWORD_KIND);
  if (!emailRow || !passwordRow) {
    return null;
  }

  const email = await keyVault.getSecret(emailRow.secretName);
  const password = await keyVault.getSecret(passwordRow.secretName);
  if (email === undefined || password === undefined) {
    return null;
  }

  const now = new Date();
  await db
    .update(externalAuthSecrets)
    .set({ lastUsedAt: now })
    .where(eq(externalAuthSecrets.id, emailRow.id));
  await db
    .update(externalAuthSecrets)
    .set({ lastUsedAt: now })
    .where(eq(externalAuthSecrets.id, passwordRow.id));

  await db.insert(externalAuthSecretAudit).values({
    orgId,
    userId,
    provider: PROVIDER,
    action: "read",
    reason,
  });

  return { email, password };
}

/**
 * Get Facebook credentials for an org (uses any user that has stored credentials for this org).
 * Used by flows that have orgId but not userId (e.g. listing automation). Caller must zero out after use.
 */
export async function getFacebookCredentialsForOrg(
  orgId: string,
  reason: string
): Promise<{ email: string; password: string; userId: string } | null> {
  if (!keyVault.isKeyVaultConfigured()) {
    return null;
  }
  const rows = await db
    .select({ userId: externalAuthSecrets.userId })
    .from(externalAuthSecrets)
    .where(
      and(
        eq(externalAuthSecrets.orgId, orgId),
        eq(externalAuthSecrets.provider, PROVIDER)
      )
    );
  const userIds = [...new Set(rows.map((r) => r.userId))];
  for (const uid of userIds) {
    const creds = await getFacebookCredentials(uid, orgId, reason);
    if (creds) return { ...creds, userId: uid };
  }
  return null;
}

/**
 * Check if we have stored Facebook credentials for this org/user (references exist).
 */
export async function hasFacebookCredentials(userId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: externalAuthSecrets.id })
    .from(externalAuthSecrets)
    .where(
      and(
        eq(externalAuthSecrets.orgId, orgId),
        eq(externalAuthSecrets.userId, userId),
        eq(externalAuthSecrets.provider, PROVIDER)
      )
    );
  return rows.length >= 2;
}

/**
 * Check if any user has stored Facebook credentials for this org.
 */
export async function hasFacebookCredentialsForOrg(orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: externalAuthSecrets.id })
    .from(externalAuthSecrets)
    .where(
      and(
        eq(externalAuthSecrets.orgId, orgId),
        eq(externalAuthSecrets.provider, PROVIDER)
      )
    );
  return rows.length >= 2;
}

/**
 * Delete Facebook credential references and optionally purge Key Vault secrets.
 * Call on disconnect. We do not delete from Key Vault by default (retention); can be added later.
 */
export async function deleteFacebookCredentials(userId: string, orgId: string): Promise<void> {
  await db
    .delete(externalAuthSecrets)
    .where(
      and(
        eq(externalAuthSecrets.orgId, orgId),
        eq(externalAuthSecrets.userId, userId),
        eq(externalAuthSecrets.provider, PROVIDER)
      )
    );
}

/** Feature flag: if false, require Key Vault credentials (reconnect) instead of plaintext fallback. */
export function allowHardLoginFallback(): boolean {
  return process.env.ALLOW_HARD_LOGIN_FALLBACK === "true" || process.env.ALLOW_HARD_LOGIN_FALLBACK === "1";
}
