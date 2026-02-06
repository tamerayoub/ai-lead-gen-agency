# API Connector Architecture

> Versioned REST API for external PMS/integrators to read and write Lead2Lease data programmatically.  
> This document tracks design decisions, naming conventions, and development progress.

## Overview

The API Connector is an integration option in the Integrations section that exposes a secure, versioned REST API. External property management systems (PMS) and integrators can programmatically sync leads, conversations, tours, properties, units, and listings—with strong auth, audit logs, idempotency, pagination, filtering, and webhooks.

**Base path:** `/api/integrations/api/v1`

**Auth:** `Authorization: Bearer <api_key>`

**Scopes:** Coarse-grained (`leads:read`, `leads:write`, `conversations:read`, `conversations:write`, `tours:read`, `tours:write`, `properties:read`, `properties:write`, `listings:read`, `listings:write`, `webhooks:manage`)

---

## Lead2Lease Conventions (Applied)

| Aspect | Convention | API Connector Implementation |
|--------|------------|-----------------------------|
| Table names | `snake_case`, plural where logical | `integration_api_keys`, `integration_api_audit_log`, etc. |
| Primary keys | `id` (uuid) | Same |
| Org scoping | `org_id` on all tenant tables | All tables include `org_id` |
| Timestamps | `created_at`, `updated_at` | Same |
| Drizzle schema | `shared/schema.ts` | New tables added there |
| Migrations | `migrations/NNN_<description>.sql` | `022_add_api_connector_tables.sql` |
| Routes | `/api/<resource>` | `/api/integrations/api/v1/<resource>` |
| Internal APIs | `isAuthenticated`, `attachOrgContext` | New `requireApiKey` middleware for external API |

---

## Data Model

### Tables

| Table | Purpose |
|-------|---------|
| `integration_api_keys` | API keys (hashed, prefix for lookup). Scopes, enabled, revoked. |
| `integration_api_audit_log` | Per-request audit (method, path, status, duration, api_key_id). |
| `integration_api_idempotency` | Idempotency for POST/PUT/PATCH writes. |
| `integration_api_webhook_endpoints` | Webhook URLs, secret, events, enabled. |
| `integration_api_webhook_deliveries` | Delivery attempts, retries, response snippets. |

### Org Setting

- `integrations_api_share_pii` (org config): If `false`, redact email/phone even when scope allows. Default `false`.

---

## Auth Flow

1. Client sends `Authorization: Bearer <api_key>`.
2. Extract key, take first 8 chars as `key_prefix`, lookup by `key_prefix` + `org_id`.
3. Verify hash with constant-time compare (e.g. `crypto.timingSafeEqual`).
4. Reject if `is_enabled = false` or `revoked_at IS NOT NULL`.
5. Attach `req.apiKey` (id, orgId, scopes) and `req.orgId` for downstream handlers.

---

## API Endpoints (v1)

### Leads
- `GET /leads` – List (filters: updated_since, source, status; pagination: cursor, limit)
- `POST /leads` – Create (Idempotency-Key required)
- `GET /leads/:leadId` – Get one
- `PATCH /leads/:leadId` – Update profile, status
- `POST /leads/:leadId/sources` – Add lead source attribution
- `GET /leads/:leadId/sources` – List sources

### Conversations & Messages
- `GET /conversations` – List (leadId, cursor, limit)
- `POST /conversations` – Create (optional)
- `GET /conversations/:conversationId` – Get one
- `GET /conversations/:conversationId/messages` – List messages
- `POST /conversations/:conversationId/messages` – Add message (Idempotency-Key required)
- `GET /conversations/:conversationId/summary` – AI summary (if allowed)

### Tours
- `GET /tours/slots` – Available slots (propertyId, unitId, from, to)
- `POST /tours/bookings` – Create booking (Idempotency-Key required)
- `GET /tours/bookings` – List bookings (leadId, propertyId, cursor, limit)
- `GET /tours/bookings/:bookingId` – Get one
- `PATCH /tours/bookings/:bookingId` – Reschedule/cancel

### Properties / Units / Listings
- `GET /properties` – List
- `GET /properties/:propertyId` – Get one
- `GET /properties/:propertyId/units` – List units
- `GET /listings` – List (propertyId, unitId, status)
- *(Optional behind feature flag)* `POST/PATCH /properties`, `/units`, `/listings`

### Webhooks (Internal UI API)
- `POST /api/integrations/api-connector/webhooks` – Create endpoint (admin only)
- `GET /api/integrations/api-connector/webhooks` – List
- `PATCH /api/integrations/api-connector/webhooks/:id` – Enable/disable, update events (admin only)
- `POST /api/integrations/api-connector/webhooks/:id/rotate-secret` – Rotate secret, returns new secret once (admin only)
- `DELETE /api/integrations/api-connector/webhooks/:id` – Delete (admin only)

### Audit & Downloads
- `GET /api/integrations/api-connector/audit?limit=50&statusGroup=&resource=` – Activity log (last 50 API calls)
- `GET /api/integrations/api-connector/openapi` – Download OpenAPI YAML
- `GET /api/integrations/api-connector/postman` – Download Postman collection

### Internal UI: API Keys
- `POST /api/integrations/api-connector/keys` – Create key (returns secret once, admin only)
- `GET /api/integrations/api-connector/keys` – List (no secrets)
- `DELETE /api/integrations/api-connector/keys/:id` – Revoke (admin only)

---

## Response Envelope

Success:
```json
{
  "data": { ... },
  "meta": { "requestId": "...", "nextCursor": "...", "count": 123 }
}
```

Error:
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

---

## Webhooks

**Events:** `lead.created`, `lead.updated`, `message.created`, `tour.booking.created`, `tour.booking.updated`

**Signing:** HMAC SHA256 of payload; header `X-Lead2Lease-Signature` with `t=<timestamp>,v1=<signature>`. Timestamp used to reject replays (e.g. >5 min old).

**Delivery:** Background worker retries with exponential backoff. Store attempts in `integration_api_webhook_deliveries`.

---

## Idempotency

- Required header: `Idempotency-Key` for POST/PUT/PATCH that create/update resources.
- Key format: unique string per client (e.g. UUID).
- Scope: per org + idempotency key. Same key + same request hash → return stored response.
- TTL: 24h (configurable).

---

## Folder Structure

```
server/
  integrations/
    apiConnector/
      index.ts          # Mount routes, export router
      auth.ts           # API key validation, scope check
      rateLimit.ts      # Per-key rate limiting
      idempotency.ts    # Idempotency middleware/handler
      routes.ts         # v1 REST routes
      controllers/      # Handlers per resource
      mappers/          # DB → API canonical shape
      webhooks/         # Webhook delivery, signing
  routes.ts             # Mount apiConnector at /api/integrations/api/v1
```

---

## Integration UI

- Integrations screen shows **"API"** (or "API Connector") card.
- Status: configured when ≥1 active key exists.
- Displays: key count, webhook count.
- Links to sub-page or modal for keys + webhooks management.

---

## Security

- Never expose: raw tokens, internal notes (unless explicitly allowed), secrets.
- PII: only when `integrations_api_share_pii=true` and scope allows.
- Rate limiting: per API key (e.g. 100 req/min).
- All queries filtered by `org_id` from the API key.

---

## Development Status

| Component | Status |
|-----------|--------|
| Architecture doc | ✅ Done |
| Migrations | ✅ Done |
| Drizzle schema | ✅ Done |
| API key auth | ✅ Done |
| REST routes (read) | ✅ Done |
| Integration UI | ✅ Done |
| OpenAPI spec | ✅ Done |
| Webhooks delivery | 🔄 Stub (DB ready, delivery worker pending) |
| Write endpoints (POST/PATCH) | Pending |
| Idempotency middleware | Pending |
| Tests | Pending |

---

## Integration Setup (Documentation Snippet)

### Enabling the API Connector

1. Go to **Integrations** in the Lead2Lease app (sidebar → Integrations).
2. Find the **API** card under **API & Developers** (first section).
3. Click **Configure** or **Manage** → navigates to **Integrations → API** page.
4. On the API Connector page:
   - **API Keys**: Click "Create API Key", enter a name (e.g. "Production") or leave blank, click "Generate Key".
   - **Copy and save the key immediately** — it is shown only once.
   - Use the key in requests: `Authorization: Bearer <your_api_key>`.
5. **Getting Started** card shows Base URL, auth header, and first-request examples (cURL + JS).
6. **Recipes** card provides copy-paste examples for List Leads, Get Lead, List Conversations, List Tour Bookings.
7. **API Docs** card: Download OpenAPI Spec (YAML) or Postman Collection.
8. **Webhooks**: Add endpoint URL, select events, create. Secret shown once. Rotate Secret available per endpoint.
9. **Activity Log**: View last 50 API calls (method, path, status, duration).

### Base URL

- **Production:** `https://app.lead2lease.ai/api/integrations/api/v1`
- **Local/dev:** `http://localhost:5000/api/integrations/api/v1`

The base URL is displayed on the API Connector page.

### RBAC

- Only org admins (admin, owner, property_manager) can create/revoke API keys and manage webhooks.
- Any org member can view status, Getting Started, docs, and Activity Log.

### Example Request

```bash
curl -H "Authorization: Bearer l2l_xxxxx" \
  "https://app.lead2lease.ai/api/integrations/api/v1/leads?limit=10"
```

For local development:
```bash
curl -H "Authorization: Bearer l2l_xxxxx" \
  "http://localhost:5000/api/integrations/api/v1/leads?limit=10"
```

### Webhook Signature Verification

Webhooks use HMAC SHA256. Verify with headers:
- `X-Lead2Lease-Signature`: `t=<timestamp>,v1=<hmac_hex>`
- `X-Lead2Lease-Timestamp`: Unix timestamp (reject if >5 min old to prevent replay)

```javascript
const crypto = require('crypto');
const sigHeader = req.headers['x-lead2lease-signature'];
const timestamp = req.headers['x-lead2lease-timestamp'];
const [t, v1] = sigHeader.split(',').reduce((o, p) => {
  const [k, v] = p.split('=');
  o[k.trim()] = v.trim();
  return o;
}, {});
const payload = `${timestamp}.${JSON.stringify(req.body)}`;
const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
if (v1 !== expected) throw new Error('Invalid signature');
```

### Scopes

Keys are created with full access by default. Scopes control what the key can read/write:

- `leads:read`, `leads:write`
- `conversations:read`, `conversations:write`
- `tours:read`, `tours:write`
- `properties:read`, `properties:write`
- `listings:read`, `listings:write`
- `webhooks:manage`

---

## Relation to AI Leasing Agent

- The API Connector is a **provider** for external PMS systems: they call us.
- Future tools like `sync_lead_to_external()` or `sync_tour_to_external()` could push data to external systems via their webhooks or via the API Connector acting as a bidirectional bridge.
- Guardrail: never claim sync succeeded without `200 OK` + audit log entry.
