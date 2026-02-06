/**
 * Storage for API Connector - keys, webhooks, audit, idempotency.
 * Uses db directly to keep API Connector self-contained.
 */

import crypto from "crypto";
import { db } from "../../db";
import {
  integrationApiKeys,
  integrationApiAuditLog,
  integrationApiIdempotency,
  integrationApiWebhookEndpoints,
  integrationApiWebhookDeliveries,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const KEY_PREFIX_LEN = 8;

export function generateApiKey(): { raw: string; prefix: string; hashed: string } {
  const raw = `l2l_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, KEY_PREFIX_LEN);
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hashed };
}

export async function createApiKey(params: {
  orgId: string;
  name: string;
  scopes: string[];
  createdByUserId?: string;
}) {
  const { raw, prefix, hashed } = generateApiKey();
  const [row] = await db
    .insert(integrationApiKeys)
    .values({
      orgId: params.orgId,
      name: params.name,
      hashedKey: hashed,
      keyPrefix: prefix,
      scopes: params.scopes,
      isEnabled: true,
      createdByUserId: params.createdByUserId,
    })
    .returning();
  return { ...row, rawKey: raw };
}

export async function listApiKeys(orgId: string) {
  return db
    .select({
      id: integrationApiKeys.id,
      name: integrationApiKeys.name,
      keyPrefix: integrationApiKeys.keyPrefix,
      scopes: integrationApiKeys.scopes,
      isEnabled: integrationApiKeys.isEnabled,
      createdAt: integrationApiKeys.createdAt,
      revokedAt: integrationApiKeys.revokedAt,
      lastUsedAt: integrationApiKeys.lastUsedAt,
    })
    .from(integrationApiKeys)
    .where(eq(integrationApiKeys.orgId, orgId))
    .orderBy(desc(integrationApiKeys.createdAt));
}

export async function revokeApiKey(id: string, orgId: string): Promise<boolean> {
  const result = await db
    .update(integrationApiKeys)
    .set({ revokedAt: new Date(), isEnabled: false })
    .where(and(eq(integrationApiKeys.id, id), eq(integrationApiKeys.orgId, orgId)))
    .returning({ id: integrationApiKeys.id });
  return result.length > 0;
}

export async function updateApiKeyLastUsed(id: string): Promise<void> {
  await db
    .update(integrationApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(integrationApiKeys.id, id));
}

export async function createAuditLog(entry: {
  orgId: string;
  apiKeyId?: string;
  actorType?: string;
  method: string;
  path: string;
  statusCode?: number;
  requestId?: string;
  idempotencyKey?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}) {
  await db.insert(integrationApiAuditLog).values({
    orgId: entry.orgId,
    apiKeyId: entry.apiKeyId,
    actorType: entry.actorType ?? "api_key",
    method: entry.method,
    path: entry.path,
    statusCode: entry.statusCode,
    requestId: entry.requestId,
    idempotencyKey: entry.idempotencyKey,
    ip: entry.ip,
    userAgent: entry.userAgent,
    durationMs: entry.durationMs,
  });
}

export async function getIdempotentResponse(
  orgId: string,
  idempotencyKey: string
): Promise<{ status: number; body: string } | null> {
  const rows = await db
    .select({
      responseStatus: integrationApiIdempotency.responseStatus,
      responseBodyJson: integrationApiIdempotency.responseBodyJson,
    })
    .from(integrationApiIdempotency)
    .where(
      and(
        eq(integrationApiIdempotency.orgId, orgId),
        eq(integrationApiIdempotency.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { status: row.responseStatus, body: row.responseBodyJson ?? "{}" };
}

export async function storeIdempotentResponse(params: {
  orgId: string;
  apiKeyId?: string;
  idempotencyKey: string;
  method: string;
  path: string;
  requestHash: string;
  responseStatus: number;
  responseBodyJson: string;
}) {
  await db.insert(integrationApiIdempotency).values({
    orgId: params.orgId,
    apiKeyId: params.apiKeyId,
    idempotencyKey: params.idempotencyKey,
    method: params.method,
    path: params.path,
    requestHash: params.requestHash,
    responseStatus: params.responseStatus,
    responseBodyJson: params.responseBodyJson,
  });
}

export async function createWebhookEndpoint(params: {
  orgId: string;
  url: string;
  secret: string;
  events: string[];
}) {
  const [row] = await db
    .insert(integrationApiWebhookEndpoints)
    .values({
      orgId: params.orgId,
      url: params.url,
      secret: params.secret,
      events: params.events,
      isEnabled: true,
    })
    .returning();
  return row!;
}

export async function listWebhookEndpoints(orgId: string) {
  return db
    .select({
      id: integrationApiWebhookEndpoints.id,
      url: integrationApiWebhookEndpoints.url,
      events: integrationApiWebhookEndpoints.events,
      isEnabled: integrationApiWebhookEndpoints.isEnabled,
      createdAt: integrationApiWebhookEndpoints.createdAt,
    })
    .from(integrationApiWebhookEndpoints)
    .where(eq(integrationApiWebhookEndpoints.orgId, orgId))
    .orderBy(desc(integrationApiWebhookEndpoints.createdAt));
}

export async function updateWebhookEndpoint(
  id: string,
  orgId: string,
  updates: { isEnabled?: boolean; secret?: string; events?: string[] }
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.isEnabled !== undefined) set.isEnabled = updates.isEnabled;
  if (updates.secret !== undefined) set.secret = updates.secret;
  if (updates.events !== undefined) set.events = updates.events;

  const [row] = await db
    .update(integrationApiWebhookEndpoints)
    .set(set)
    .where(
      and(
        eq(integrationApiWebhookEndpoints.id, id),
        eq(integrationApiWebhookEndpoints.orgId, orgId)
      )
    )
    .returning();
  return row ?? null;
}

export async function deleteWebhookEndpoint(id: string, orgId: string): Promise<boolean> {
  const result = await db
    .delete(integrationApiWebhookEndpoints)
    .where(
      and(
        eq(integrationApiWebhookEndpoints.id, id),
        eq(integrationApiWebhookEndpoints.orgId, orgId)
      )
    )
    .returning({ id: integrationApiWebhookEndpoints.id });
  return result.length > 0;
}

export async function listAuditLogs(
  orgId: string,
  options: { limit?: number; cursor?: string; statusGroup?: string; resource?: string } = {}
) {
  const limit = Math.min(options.limit ?? 50, 100);
  const rows = await db
    .select({
      id: integrationApiAuditLog.id,
      method: integrationApiAuditLog.method,
      path: integrationApiAuditLog.path,
      statusCode: integrationApiAuditLog.statusCode,
      requestId: integrationApiAuditLog.requestId,
      idempotencyKey: integrationApiAuditLog.idempotencyKey,
      durationMs: integrationApiAuditLog.durationMs,
      createdAt: integrationApiAuditLog.createdAt,
      keyPrefix: integrationApiKeys.keyPrefix,
    })
    .from(integrationApiAuditLog)
    .leftJoin(integrationApiKeys, eq(integrationApiAuditLog.apiKeyId, integrationApiKeys.id))
    .where(eq(integrationApiAuditLog.orgId, orgId))
    .orderBy(desc(integrationApiAuditLog.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0
    ? (items[items.length - 1] as any).createdAt
    : undefined;

  let filtered = items;
  if (options.statusGroup) {
    if (options.statusGroup === "2xx") {
      filtered = filtered.filter((r) => r.statusCode != null && r.statusCode >= 200 && r.statusCode < 300);
    } else if (options.statusGroup === "4xx") {
      filtered = filtered.filter((r) => r.statusCode != null && r.statusCode >= 400 && r.statusCode < 500);
    } else if (options.statusGroup === "5xx") {
      filtered = filtered.filter((r) => r.statusCode != null && r.statusCode >= 500);
    }
  }
  if (options.resource) {
    const res = options.resource.toLowerCase();
    filtered = filtered.filter((row) => (row as any).path?.toLowerCase().includes(res));
  }

  return { items: filtered, nextCursor };
}

export async function rotateWebhookSecret(id: string, orgId: string): Promise<{ secret: string } | null> {
  const secret = crypto.randomBytes(32).toString("hex");
  const [row] = await db
    .update(integrationApiWebhookEndpoints)
    .set({ secret, updatedAt: new Date() })
    .where(
      and(
        eq(integrationApiWebhookEndpoints.id, id),
        eq(integrationApiWebhookEndpoints.orgId, orgId)
      )
    )
    .returning();
  return row ? { secret } : null;
}

export async function getWebhookEndpointsForEvent(orgId: string, eventType: string) {
  return db
    .select()
    .from(integrationApiWebhookEndpoints)
    .where(
      and(
        eq(integrationApiWebhookEndpoints.orgId, orgId),
        eq(integrationApiWebhookEndpoints.isEnabled, true)
      )
    )
    .then((rows) =>
      rows.filter((r) => {
        const events = Array.isArray(r.events) ? (r.events as string[]) : [];
        return events.includes(eventType) || events.includes("*");
      })
    );
}
