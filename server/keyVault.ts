/**
 * Azure Key Vault client for secure secret storage.
 * Uses DefaultAzureCredential (env: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID).
 * KEY_VAULT_URI must be set (e.g. https://lead2lease-kv.vault.azure.net/).
 * No secrets are logged or returned to callers except in-memory for immediate use.
 */

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const KEY_VAULT_URI = process.env.KEY_VAULT_URI;

let cachedClient: SecretClient | null = null;

function getClient(): SecretClient {
  if (!KEY_VAULT_URI) {
    throw new Error("KEY_VAULT_URI environment variable is required for Key Vault");
  }
  if (!cachedClient) {
    try {
      const credential = new DefaultAzureCredential();
      cachedClient = new SecretClient(KEY_VAULT_URI, credential);
      const host = KEY_VAULT_URI.replace(/^https?:\/\//, "").split("/")[0] || "vault";
      console.log("[Key Vault] Client initialized for", host);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Key Vault] Failed to create client:", msg);
      throw err;
    }
  }
  return cachedClient;
}

/**
 * Set a secret in Key Vault. Overwrites if name exists.
 * Do not log the value.
 */
export async function setSecret(secretName: string, value: string): Promise<void> {
  const client = getClient();
  const sanitizedName = secretName.replace(/[^a-zA-Z0-9-]/g, "-");
  try {
    await client.setSecret(sanitizedName, value);
    console.log("[Key Vault] Secret set successfully:", sanitizedName);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Key Vault] setSecret failed for", sanitizedName, ":", msg);
    throw err;
  }
}

/**
 * Get a secret value from Key Vault. Use only in-memory and zero out after use.
 * Do not log the value.
 */
export async function getSecret(secretName: string): Promise<string | undefined> {
  const client = getClient();
  const sanitizedName = secretName.replace(/[^a-zA-Z0-9-]/g, "-");
  try {
    const secret = await client.getSecret(sanitizedName);
    return secret?.value;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Key Vault] getSecret failed for", sanitizedName, ":", msg);
    return undefined;
  }
}

/**
 * Check if Key Vault is configured (URI set). Does not validate credentials.
 */
export function isKeyVaultConfigured(): boolean {
  return !!KEY_VAULT_URI;
}

/**
 * Verify connection to Key Vault (credentials + network). Call for debugging or health checks.
 * Logs result; does not expose secrets.
 */
export async function checkKeyVaultConnection(): Promise<{ ok: boolean; message: string }> {
  if (!KEY_VAULT_URI) {
    return { ok: false, message: "KEY_VAULT_URI not set" };
  }
  try {
    const client = getClient();
    await client.listPropertiesOfSecrets().next();
    console.log("[Key Vault] Connection check: OK");
    return { ok: true, message: "Connected" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Key Vault] Connection check failed:", msg);
    return { ok: false, message: msg };
  }
}
