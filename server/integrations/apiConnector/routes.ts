/**
 * API Connector routes - v1 REST API + internal UI endpoints.
 * See server/API_CONNECTOR_ARCHITECTURE.md
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireApiKey, requireScope, type ApiKeyInfo, type Scopes } from "./auth";
import * as apiConnectorStorage from "./storage";
import { storage } from "../../storage";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { leads, conversations, showings, properties, propertyUnits, listings } from "@shared/schema";
import { db } from "../../db";
import crypto from "crypto";

const router = Router();

const SCOPES_ALL: Scopes[] = [
  "leads:read", "leads:write", "conversations:read", "conversations:write",
  "tours:read", "tours:write", "properties:read", "properties:write",
  "listings:read", "listings:write", "webhooks:manage",
];

// --- Helpers ---

function requestId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function apiJson(res: Response, data: unknown, meta?: Record<string, unknown>) {
  const requestId = (res as any).requestId as string | undefined;
  res.json({
    data,
    meta: {
      requestId: requestId ?? undefined,
      ...meta,
    },
  });
}

function apiError(res: Response, code: string, message: string, status = 400, details?: unknown) {
  res.status(status).json({
    error: { code, message, details },
  });
}

function redactPii(obj: Record<string, unknown>, sharePii: boolean): Record<string, unknown> {
  if (sharePii) return obj;
  const copy = { ...obj };
  if ("email" in copy && copy.email) copy.email = "[redacted]";
  if ("phone" in copy && copy.phone) copy.phone = "[redacted]";
  return copy;
}

// --- Internal UI routes (session auth) - mounted by main routes with isAuthenticated + attachOrgContext ---

function requireAdminOrOwner(req: any, res: any, next: any) {
  const role = req.role as string | undefined;
  if (role === "admin" || role === "owner" || role === "property_manager") {
    return next();
  }
  return res.status(403).json({ error: "Only org admins can manage API keys and webhooks" });
}

export function createInternalRoutes(
  isAuthenticated: (req: any, res: any, next: any) => void,
  attachOrgContext: (req: any, res: any, next: any) => void
): Router {
  const internal = Router();
  const adminOnly = [isAuthenticated, attachOrgContext, requireAdminOrOwner];

  internal.get("/status", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const orgId = req.orgId;
      const keys = await apiConnectorStorage.listApiKeys(orgId);
      const webhooks = await apiConnectorStorage.listWebhookEndpoints(orgId);
      const activeKeys = keys.filter((k) => !k.revokedAt && k.isEnabled);
      res.json({
        configured: activeKeys.length > 0,
        keyCount: activeKeys.length,
        webhookCount: webhooks.length,
      });
    } catch (e) {
      console.error("[API Connector] status error:", e);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  internal.post("/keys", ...adminOnly, async (req: any, res) => {
    try {
      const body = z.object({
        name: z.string().min(1).max(100),
        scopes: z.array(z.enum(SCOPES_ALL as [string, ...string[]])).default(SCOPES_ALL),
      }).parse(req.body);

      const created = await apiConnectorStorage.createApiKey({
        orgId: req.orgId,
        name: body.name,
        scopes: body.scopes,
        createdByUserId: req.user?.id,
      });

      res.status(201).json({
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        scopes: created.scopes,
        createdAt: created.createdAt,
        rawKey: created.rawKey,
        message: "Save this key securely. It will not be shown again.",
      });
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ error: e.errors });
      }
      console.error("[API Connector] create key error:", e);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  internal.get("/keys", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const keys = await apiConnectorStorage.listApiKeys(req.orgId);
      res.json(keys);
    } catch (e) {
      console.error("[API Connector] list keys error:", e);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  internal.delete("/keys/:id", ...adminOnly, async (req: any, res) => {
    try {
      const ok = await apiConnectorStorage.revokeApiKey(req.params.id, req.orgId);
      if (!ok) return res.status(404).json({ error: "API key not found" });
      res.status(204).send();
    } catch (e) {
      console.error("[API Connector] revoke key error:", e);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  internal.post("/webhooks", ...adminOnly, async (req: any, res) => {
    try {
      const body = z.object({
        url: z.string().url(),
        events: z.array(z.string()).default(["lead.created", "lead.updated", "message.created", "tour.booking.created", "tour.booking.updated"]),
      }).parse(req.body);

      const secret = crypto.randomBytes(32).toString("hex");
      const endpoint = await apiConnectorStorage.createWebhookEndpoint({
        orgId: req.orgId,
        url: body.url,
        secret,
        events: body.events,
      });

      res.status(201).json({
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        isEnabled: endpoint.isEnabled,
        secret,
        createdAt: endpoint.createdAt,
        message: "Save the secret securely. It will not be shown again.",
      });
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ error: e.errors });
      }
      console.error("[API Connector] create webhook error:", e);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  internal.get("/webhooks", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const list = await apiConnectorStorage.listWebhookEndpoints(req.orgId);
      res.json(list);
    } catch (e) {
      console.error("[API Connector] list webhooks error:", e);
      res.status(500).json({ error: "Failed to list webhooks" });
    }
  });

  internal.patch("/webhooks/:id", ...adminOnly, async (req: any, res) => {
    try {
      const body = z.object({
        isEnabled: z.boolean().optional(),
        events: z.array(z.string()).optional(),
      }).parse(req.body);

      const updated = await apiConnectorStorage.updateWebhookEndpoint(req.params.id, req.orgId, body);
      if (!updated) return res.status(404).json({ error: "Webhook not found" });
      res.json(updated);
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ error: e.errors });
      }
      console.error("[API Connector] update webhook error:", e);
      res.status(500).json({ error: "Failed to update webhook" });
    }
  });

  internal.delete("/webhooks/:id", ...adminOnly, async (req: any, res) => {
    try {
      const ok = await apiConnectorStorage.deleteWebhookEndpoint(req.params.id, req.orgId);
      if (!ok) return res.status(404).json({ error: "Webhook not found" });
      res.status(204).send();
    } catch (e) {
      console.error("[API Connector] delete webhook error:", e);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  internal.post("/webhooks/:id/rotate-secret", ...adminOnly, async (req: any, res) => {
    try {
      const result = await apiConnectorStorage.rotateWebhookSecret(req.params.id, req.orgId);
      if (!result) return res.status(404).json({ error: "Webhook not found" });
      res.json({ secret: result.secret, message: "Save this secret securely. It will not be shown again." });
    } catch (e) {
      console.error("[API Connector] rotate webhook secret error:", e);
      res.status(500).json({ error: "Failed to rotate secret" });
    }
  });

  internal.get("/audit", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string | undefined;
      const statusGroup = req.query.statusGroup as string | undefined;
      const resource = req.query.resource as string | undefined;
      const result = await apiConnectorStorage.listAuditLogs(req.orgId, {
        limit,
        cursor,
        statusGroup,
        resource,
      });
      res.json(result);
    } catch (e) {
      console.error("[API Connector] audit error:", e);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  internal.get("/openapi", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const yamlPath = path.join(process.cwd(), "server", "integrations", "apiConnector", "openapi.yaml");
      const yaml = fs.readFileSync(yamlPath, "utf-8");
      res.setHeader("Content-Type", "application/x-yaml");
      if (req.query.inline !== "1") {
        res.setHeader("Content-Disposition", 'attachment; filename="lead2lease-openapi.yaml"');
      }
      res.send(yaml);
    } catch (e) {
      console.error("[API Connector] openapi error:", e);
      res.status(500).json({ error: "Failed to fetch OpenAPI spec" });
    }
  });

  internal.get("/postman", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const baseUrl = typeof process !== "undefined" && process.env.PUBLIC_URL
        ? process.env.PUBLIC_URL
        : "http://localhost:5000";
      const postman = {
        info: { name: "Lead2Lease API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
        variable: [{ key: "baseUrl", value: `${baseUrl}/api/integrations/api/v1` }, { key: "apiKey", value: "YOUR_API_KEY" }],
        item: [
          { name: "List Leads", request: { method: "GET", header: [{ key: "Authorization", value: "Bearer {{apiKey}}" }], url: "{{baseUrl}}/leads?limit=10" } },
          { name: "Get Lead", request: { method: "GET", header: [{ key: "Authorization", value: "Bearer {{apiKey}}" }], url: "{{baseUrl}}/leads/:leadId" } },
          { name: "List Conversations", request: { method: "GET", header: [{ key: "Authorization", value: "Bearer {{apiKey}}" }], url: "{{baseUrl}}/conversations?leadId=:leadId" } },
          { name: "List Tour Bookings", request: { method: "GET", header: [{ key: "Authorization", value: "Bearer {{apiKey}}" }], url: "{{baseUrl}}/tours/bookings" } },
          { name: "List Properties", request: { method: "GET", header: [{ key: "Authorization", value: "Bearer {{apiKey}}" }], url: "{{baseUrl}}/properties" } },
        ],
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="lead2lease-postman.json"');
      res.json(postman);
    } catch (e) {
      console.error("[API Connector] postman download error:", e);
      res.status(500).json({ error: "Failed to generate Postman collection" });
    }
  });

  return internal;
}

// --- v1 API middleware: audit + requestId ---

function v1Middleware(req: Request, res: Response, next: () => void) {
  const rid = requestId();
  (res as any).requestId = rid;
  (req as any).requestId = rid;
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const apiKey = (req as any).apiKey as ApiKeyInfo | undefined;
    apiConnectorStorage.createAuditLog({
      orgId: (req as any).orgId,
      apiKeyId: apiKey?.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      requestId: rid,
      idempotencyKey: req.headers["idempotency-key"] as string | undefined,
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      durationMs: duration,
    }).catch((err) => console.error("[API Connector] audit log error:", err));
    if (apiKey?.id) {
      apiConnectorStorage.updateApiKeyLastUsed(apiKey.id).catch(() => {});
    }
  });
  next();
}

// --- v1 API routes (API key auth) ---

function mapLeadToApi(lead: any, sharePii: boolean) {
  const obj = {
    id: lead.id,
    externalId: lead.externalId ?? undefined,
    name: lead.name,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    status: lead.status,
    source: { channel: lead.source, details: lead.metadata ?? {} },
    propertyId: lead.propertyId ?? undefined,
    unitId: undefined as string | undefined,
    tags: [],
    createdAt: lead.createdAt,
    updatedAt: lead.lastContactAt,
  };
  return redactPii(obj as any, sharePii) as typeof obj;
}

function mapConversationToApi(c: any) {
  return {
    id: c.id,
    leadId: c.leadId,
    type: c.type,
    channel: c.channel,
    message: c.message?.slice(0, 500),
    aiGenerated: c.aiGenerated ?? false,
    createdAt: c.createdAt,
  };
}

function mapShowingToApi(s: any) {
  return {
    id: s.id,
    leadId: s.leadId,
    propertyId: s.propertyId,
    unitId: s.unitId ?? undefined,
    slotId: `${s.scheduledDate}_${s.scheduledTime}`,
    startTime: s.scheduledDate,
    endTime: s.scheduledTime,
    timezone: "America/Chicago",
    status: s.status === "confirmed" || s.status === "completed" ? "booked" : s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

router.use(v1Middleware);

router.get("/leads", requireApiKey, requireScope("leads:read"), async (req: any, res) => {
  try {
    const orgId = req.orgId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const updatedSince = req.query.updated_since as string | undefined;
    const source = req.query.source as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = [eq(leads.orgId, orgId)];
    if (updatedSince) {
      conditions.push(gte(leads.lastContactAt, new Date(updatedSince)));
    }
    if (source) conditions.push(eq(leads.source, source));
    if (status) conditions.push(eq(leads.status, status));

    const rows = await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.lastContactAt)).limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    const sharePii = true;
    const data = items.map((l) => mapLeadToApi(l, sharePii));

    apiJson(res, data, { nextCursor, count: data.length });
  } catch (e) {
    console.error("[API v1] GET /leads error:", e);
    apiError(res, "internal_error", "Failed to list leads", 500);
  }
});

router.get("/leads/:leadId", requireApiKey, requireScope("leads:read"), async (req: any, res) => {
  try {
    const lead = await storage.getLead(req.params.leadId, req.orgId);
    if (!lead) return apiError(res, "not_found", "Lead not found", 404);
    const data = mapLeadToApi(lead, true);
    apiJson(res, data);
  } catch (e) {
    console.error("[API v1] GET /leads/:id error:", e);
    apiError(res, "internal_error", "Failed to get lead", 500);
  }
});

router.get("/conversations", requireApiKey, requireScope("conversations:read"), async (req: any, res) => {
  try {
    const leadId = req.query.leadId as string | undefined;
    if (!leadId) return apiError(res, "validation_error", "leadId query param required", 400);

    const convos = await storage.getConversationsByLeadId(leadId, req.orgId);
    const data = convos.map(mapConversationToApi);
    apiJson(res, data, { count: data.length });
  } catch (e) {
    console.error("[API v1] GET /conversations error:", e);
    apiError(res, "internal_error", "Failed to list conversations", 500);
  }
});

router.get("/conversations/:conversationId/messages", requireApiKey, requireScope("conversations:read"), async (req: any, res) => {
  try {
    const { conversationId } = req.params;
    const convRows = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!convRows[0]) return apiError(res, "not_found", "Conversation not found", 404);

    const conv = convRows[0];
    const lead = await storage.getLead(conv.leadId, req.orgId);
    if (!lead || lead.orgId !== req.orgId) return apiError(res, "not_found", "Conversation not found", 404);

    const allConvos = await storage.getConversationsByLeadId(conv.leadId, req.orgId);
    const messages = allConvos.map((c) => ({
      id: c.id,
      conversationId: c.id,
      leadId: c.leadId,
      direction: (c as any).type === "incoming" || (c as any).type === "received" ? "inbound" : "outbound",
      sender: (c as any).aiGenerated ? "agent" : "lead",
      content: c.message,
      channel: c.channel,
      createdAt: (c as any).createdAt,
    }));

    apiJson(res, messages, { count: messages.length });
  } catch (e) {
    console.error("[API v1] GET /conversations/:id/messages error:", e);
    apiError(res, "internal_error", "Failed to list messages", 500);
  }
});

router.get("/tours/bookings", requireApiKey, requireScope("tours:read"), async (req: any, res) => {
  try {
    const orgId = req.orgId;
    const leadId = req.query.leadId as string | undefined;
    const propertyId = req.query.propertyId as string | undefined;

    const conditions = [eq(showings.orgId, orgId)];
    if (leadId) conditions.push(eq(showings.leadId, leadId));
    if (propertyId) conditions.push(eq(showings.propertyId, propertyId));

    const rows = await db.select().from(showings).where(and(...conditions)).orderBy(desc(showings.scheduledDate)).limit(100);

    const data = rows.map(mapShowingToApi);
    apiJson(res, data, { count: data.length });
  } catch (e) {
    console.error("[API v1] GET /tours/bookings error:", e);
    apiError(res, "internal_error", "Failed to list bookings", 500);
  }
});

router.get("/properties", requireApiKey, requireScope("properties:read"), async (req: any, res) => {
  try {
    const list = await storage.getAllProperties(req.orgId);
    const data = list.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      units: p.units,
      timezone: p.timezone,
    }));
    apiJson(res, data, { count: data.length });
  } catch (e) {
    console.error("[API v1] GET /properties error:", e);
    apiError(res, "internal_error", "Failed to list properties", 500);
  }
});

router.get("/properties/:propertyId", requireApiKey, requireScope("properties:read"), async (req: any, res) => {
  try {
    const prop = await storage.getProperty(req.params.propertyId, req.orgId);
    if (!prop) return apiError(res, "not_found", "Property not found", 404);
    apiJson(res, {
      id: prop.id,
      name: prop.name,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      units: prop.units,
      timezone: prop.timezone,
      description: prop.description,
      amenities: prop.amenities,
    });
  } catch (e) {
    console.error("[API v1] GET /properties/:id error:", e);
    apiError(res, "internal_error", "Failed to get property", 500);
  }
});

router.get("/properties/:propertyId/units", requireApiKey, requireScope("properties:read"), async (req: any, res) => {
  try {
    const prop = await storage.getProperty(req.params.propertyId, req.orgId);
    if (!prop) return apiError(res, "not_found", "Property not found", 404);

    const units = await storage.getAllUnitsByProperty(req.params.propertyId, req.orgId);
    const data = units.map((u) => ({
      id: u.id,
      propertyId: u.propertyId,
      unitNumber: u.unitNumber,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      status: u.status,
      monthlyRent: u.monthlyRent,
    }));
    apiJson(res, data, { count: data.length });
  } catch (e) {
    console.error("[API v1] GET /properties/:id/units error:", e);
    apiError(res, "internal_error", "Failed to list units", 500);
  }
});

// --- Export v1 router (to be mounted at /api/integrations/api/v1) ---
export const v1Router = router;
