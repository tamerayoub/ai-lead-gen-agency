/**
 * API Connector authentication - validates API key and enforces scopes.
 * See server/API_CONNECTOR_ARCHITECTURE.md
 */

import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db } from "../../db";
import { integrationApiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const KEY_PREFIX_LEN = 8;
const HASH_ALGORITHM = "sha256";

export type ApiKeyInfo = {
  id: string;
  orgId: string;
  scopes: string[];
};

export type Scopes = "leads:read" | "leads:write" | "conversations:read" | "conversations:write"
  | "tours:read" | "tours:write" | "properties:read" | "properties:write"
  | "listings:read" | "listings:write" | "webhooks:manage";

function hashKey(plainKey: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(plainKey).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "unauthorized", message: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
    });
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    res.status(401).json({
      error: { code: "unauthorized", message: "API key is required" },
    });
    return;
  }

  const prefix = rawKey.slice(0, KEY_PREFIX_LEN);
  const hashed = hashKey(rawKey);

  const rows = await db
    .select()
    .from(integrationApiKeys)
    .where(and(
      eq(integrationApiKeys.keyPrefix, prefix),
      eq(integrationApiKeys.isEnabled, true)
    ));

  const keyRow = rows.find((r) => timingSafeEqual(r.hashedKey, hashed));
  if (!keyRow) {
    res.status(401).json({
      error: { code: "invalid_api_key", message: "Invalid or revoked API key" },
    });
    return;
  }

  if (keyRow.revokedAt) {
    res.status(401).json({
      error: { code: "api_key_revoked", message: "This API key has been revoked" },
    });
    return;
  }

  const scopes = Array.isArray(keyRow.scopes) ? (keyRow.scopes as string[]) : [];
  (req as any).apiKey = {
    id: keyRow.id,
    orgId: keyRow.orgId,
    scopes,
  } as ApiKeyInfo;
  (req as any).orgId = keyRow.orgId;

  next();
}

export function requireScope(...required: Scopes[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey as ApiKeyInfo | undefined;
    if (!apiKey) {
      res.status(401).json({
        error: { code: "unauthorized", message: "API key required" },
      });
      return;
    }

    const hasAll = required.every((s) => apiKey.scopes.includes(s));
    if (!hasAll) {
      res.status(403).json({
        error: {
          code: "insufficient_scope",
          message: `Required scope(s): ${required.join(", ")}`,
          details: { required },
        },
      });
      return;
    }

    next();
  };
}

export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LEN);
}

export function hashApiKey(rawKey: string): string {
  return hashKey(rawKey);
}
