# Facebook Marketplace – Playwright Integration Architecture

This document explains how the Facebook Marketplace integration works: authentication, Playwright automation, tests, and how they fit together.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Authentication Flow](#authentication-flow)
3. [Server Components](#server-components)
4. [Test Files](#test-files)
5. [Playwright Configuration](#playwright-configuration)
6. [End-to-End Flows](#end-to-end-flows)
7. [Environment Variables](#environment-variables)
8. [Data Flow Diagrams](#data-flow-diagrams)

---

## High-Level Overview

The integration uses **Playwright** to automate Facebook Marketplace in a real browser. It:

- **Connects** – User logs in via UI; session is saved and encrypted
- **Polls messages** – Fetches Marketplace conversations and syncs them to the app
- **Sends messages** – Replies to leads from the app
- **Posts listings** – Creates listings on Facebook Marketplace

The system prefers **session-based auth** (Playwright `storageState`) and falls back to **hard login** using credentials from Azure Key Vault when the session is invalid.

---

## Authentication Flow

### Session-First Strategy

1. **Primary path**: Load encrypted `storageState` from the database (cookies + localStorage).
2. **Validation**: Open Facebook Marketplace in a headless browser and verify we are not on the login page.
3. **On success**: Use the session for automation (no credential handling).
4. **On failure**: Fall back to Key Vault hard login (see below).

### Key Vault Fallback

When the session is missing or invalid:

1. Fetch Facebook email/password from **Azure Key Vault**.
2. Run Playwright hard login (fill form, submit, wait for redirect).
3. Capture `storageState` and save it (encrypted) to the database.
4. Use the new session for automation.

### Important Files

| File | Responsibility |
|------|----------------|
| `server/facebookAuthManager.ts` | Session load/validate, hard login, storageState encryption, temp file for spawned processes |
| `server/facebookAuthSecrets.service.ts` | Store and retrieve credentials via Key Vault; audit logging |
| `server/keyVault.ts` | Azure Key Vault client |

### Session Storage

- **Where**: `integration_config` table, service `facebook-marketplace`, config key `storageStateEncrypted`.
- **Format**: AES-256-GCM encrypted JSON (Playwright `storageState`).
- **Key**: `ENCRYPTION_KEY` (min 32 chars).
- **Credentials**: Only references in DB; actual values live in Key Vault.

---

## Server Components

### 1. `facebookAuthManager.ts`

Central auth logic for Facebook automation.

| Function | Purpose |
|----------|---------|
| `loadStorageStateFromDb(orgId)` | Decrypt and load storageState from DB |
| `saveStorageStateToDb(orgId, state)` | Encrypt and save storageState to DB |
| `validateSession(context)` | Go to Marketplace and verify we are not on login (used by `getAuthenticatedContext` only) |
| `performHardLogin(orgId, email, pass, browser)` | Hard login with Playwright |
| `fallbackLogin(orgId)` | If no session → Key Vault creds → hard login → save |
| `getAuthenticatedContext(orgId)` | In-process context (session or fallback) |
| `getStorageStatePathForSpawnedProcess(orgId)` | For **spawned** tests: **no validation** – write DB state to temp file and return path. Test handles login detection. |
| `saveStorageStateAfterConnect(orgId, state)` | Called after initial connect flow |
| `clearStorageState(orgId)` | Called on disconnect |
| `markNeedsReconnect(orgId, reason)` | Mark integration as needing reconnect |

**Strategic: No server validation before spawn.** Validating in the server (headless) then again in the test (headed) causes Facebook to see two devices and may kick the session. The server trusts the DB and writes to temp; the test is the only thing that navigates and handles fallback login.

**Viewport/User-Agent**: `1280x720`, Chrome 120 UA – must match `playwright.config.ts` exactly so Facebook accepts the session (fingerprint alignment).

### 2. `facebookAuthSecrets.service.ts`

Handles credentials in Key Vault.

| Function | Purpose |
|----------|---------|
| `storeFacebookCredentials(userId, orgId, email, password)` | Store in Key Vault and DB references |
| `getFacebookCredentials(userId, orgId, reason)` | Retrieve for a specific user |
| `getFacebookCredentialsForOrg(orgId, reason)` | Retrieve for any user in the org |
| `allowHardLoginFallback()` | Feature flag for hard login fallback |

### 3. `facebookMarketplaceService.ts`

High-level Marketplace operations.

| Function | Purpose |
|----------|---------|
| `connectFacebookMarketplace(orgId, email, password)` | Initial connect via hard login, save storageState |
| `verifyFacebookMarketplace(orgId)` | Verify session via auth manager |
| `disconnectFacebookMarketplace(orgId)` | Clear storageState and update status |

### 4. `facebookListing.ts`

Triggers listing automation by spawning Playwright.

- Calls `getStorageStatePathForSpawnedProcess(orgId)`
- Spawns `npx playwright test tests/facebook.postlisting.spec.ts`
- Passes `PLAYWRIGHT_STORAGE_STATE_PATH`, `LISTING_ID`, `ORG_ID`, etc.

### 5. Routes (`server/routes.ts`)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/integrations/facebook-marketplace/run-message-polling` | Start message polling (spawns `facebook.message.polling.spec.ts`) |
| `POST /api/integrations/facebook-marketplace/stop-message-polling` | Stop polling process |
| `POST /api/integrations/facebook-marketplace/run-send-message` | Send messages (spawns `facebook.send.message.spec.ts`) |
| `POST /api/facebook-messages/process` | Internal – process conversations from polling script |
| `POST /api/facebook-messages/mark-sent` | Internal – mark messages as sent |

---

## Test Files

### Directory Layout

```
tests/
├── facebook.message.polling.spec.ts   # Message polling
├── facebook.send.message.spec.ts     # Send replies
├── facebook.postlisting.spec.ts      # Post listings
├── global-setup/
│   └── facebook-login.ts             # Optional: create playwright/.auth/facebook.json
└── README-playwright.md              # Short Playwright notes
```

### 1. `facebook.message.polling.spec.ts`

**Purpose**: Collect Marketplace conversations and send them to the server.

**Flow**:
1. Ensure auth (storageState or credentials).
2. Verify server is reachable.
3. Go to Facebook → detect login page → hard login if needed (Key Vault creds).
4. Dismiss popups.
5. Navigate to Marketplace (shortcuts menu or direct URL).
6. Click Messenger → Marketplace tab.
7. Wait for conversations to load.
8. Collect conversation links (`/messages/t/<id>`).
9. For each conversation: extract messages, profile ID, listing ID.
10. POST to `/api/facebook-messages/process` with secret token.

**Auth**:
- `PLAYWRIGHT_STORAGE_STATE_PATH` – set by server when spawned; uses session.
- `FACEBOOK_EMAIL` / `FACEBOOK_PASSWORD` – from Key Vault or env for fallback when on login page.

### 2. `facebook.send.message.spec.ts`

**Purpose**: Send replies to leads in Facebook Messenger.

**Flow**:
1. Ensure auth (storageState or credentials).
2. Go to Facebook and login if needed.
3. Dismiss popups.
4. Navigate to Marketplace → Messenger.
5. Fetch pending messages from `/api/facebook-messages/pending`.
6. For each pending: open conversation, type reply, send.
7. Call `/api/facebook-messages/mark-sent` for each sent message.

### 3. `facebook.postlisting.spec.ts`

**Purpose**: Post a unit listing to Facebook Marketplace.

**Flow**:
1. Read `LISTING_ID`, `ORG_ID` from env (set by server).
2. Fetch listing via `/api/listings/:id/for-facebook`.
3. Go to Facebook, login if needed.
4. Navigate to Marketplace → Create listing.
5. Fill form (images, price, description, amenities).
6. Publish listing.

### 4. `global-setup/facebook-login.ts`

**Purpose**: Optional setup for local runs without server-spawned session.

- Runs only if `PLAYWRIGHT_FB_EMAIL` and `PLAYWRIGHT_FB_PASSWORD` are set.
- Logs in and saves state to `playwright/.auth/facebook.json`.
- When server spawns tests with `PLAYWRIGHT_STORAGE_STATE_PATH`, this setup is effectively skipped (server’s temp file takes precedence).

---

## Playwright Configuration

**File**: `playwright.config.ts`

### Storage State and Browser Fingerprint

When `PLAYWRIGHT_STORAGE_STATE_PATH` is set (server-spawned runs):

- `storageState`: path to temp session file (resolved via `path.resolve`)
- `viewport`: `1280 x 720`
- `userAgent`: Chrome 120

These match `facebookAuthManager` so Facebook treats the session as the same “device” and accepts cookies.

### Projects

- `chromium` – used for all Facebook specs
- `firefox` – not used for Facebook
- `webkit` – not used for Facebook

### Web Server

- Skips starting a dev server when `PLAYWRIGHT_SKIP_WEBSERVER=true` (used when server is already running).

---

## End-to-End Flows

### Message Polling (UI → Server → Playwright)

1. User clicks “Start Polling” in Integrations UI.
2. Server receives `POST /api/integrations/facebook-marketplace/run-message-polling`.
3. Server calls `getStorageStatePathForSpawnedProcess(orgId)`:
   - Load storageState from DB → validate in headless browser.
   - If valid: write to temp file and return path.
   - If invalid: Key Vault fallback → hard login → save new session → write temp file.
4. Server spawns: `npx playwright test tests/facebook.message.polling.spec.ts --project=chromium --headed --workers=1` with env:
   - `PLAYWRIGHT_STORAGE_STATE_PATH` = temp file path
   - `PLAYWRIGHT_BASE_URL`, `FACEBOOK_LISTING_SECRET_TOKEN`, `FACEBOOK_POLLING_ORG_ID`
   - Optional: `FACEBOOK_EMAIL`, `FACEBOOK_PASSWORD` from Key Vault for fallback.
5. Test runs: loads session, goes to Marketplace, collects conversations, POSTs to `/api/facebook-messages/process`.
6. Server processes conversations and creates/updates leads in the DB.

### Send Message

1. User sends a reply from Lead2Lease.
2. Server receives send request.
3. Server spawns `facebook.send.message.spec.ts` with session path and creds.
4. Test opens the conversation and sends the message.
5. Test calls `mark-sent` when done.

### Post Listing

1. User clicks “Post to Facebook” on a listing.
2. Server calls `triggerFacebookListing(listingId, orgId)`.
3. `facebookListing.ts` gets storage path and spawns `facebook.postlisting.spec.ts` with `LISTING_ID`, `ORG_ID`.
4. Test fetches listing data, navigates to Marketplace, creates listing.

---

## Environment Variables

### Required for Auth

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_KEY` | Min 32 chars; encrypts storageState in DB |
| `KEY_VAULT_URI` | Azure Key Vault URI |
| `AZURE_CLIENT_ID` | Azure service principal |
| `AZURE_CLIENT_SECRET` | Azure service principal |
| `AZURE_TENANT_ID` | Azure tenant |

### Optional

| Variable | Purpose |
|----------|---------|
| `ALLOW_HARD_LOGIN_FALLBACK` | `true` to enable Key Vault fallback and pass creds to spawned tests |
| `PLAYWRIGHT_FB_EMAIL` | Used by global setup and local test runs |
| `PLAYWRIGHT_FB_PASSWORD` | Same as above |
| `FACEBOOK_EMAIL` / `FACEBOOK_PASSWORD` | Passed by server to spawned tests for fallback login |
| `PLAYWRIGHT_STORAGE_STATE_PATH` | Set by server when spawning tests |
| `PLAYWRIGHT_BASE_URL` | Base URL for API calls (default `http://localhost:5000`) |
| `PLAYWRIGHT_HEADLESS` | `false` to run headed |
| `PLAYWRIGHT_SKIP_WEBSERVER` | `true` when server is already running |

---

## Data Flow Diagrams

### Auth Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   getStorageStatePathForSpawnedProcess(orgId)    │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ loadStorageStateFromDb  │
                    └─────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
              [state exists]              [no state]
                    │                           │
                    ▼                           │
          ┌──────────────────┐                  │
          │ Validate session │                  │
          │ (headless goto   │                  │
          │  marketplace)    │                  │
          └──────────────────┘                  │
                    │                           │
          ┌─────────┴─────────┐                 │
          │                   │                 │
          ▼                   ▼                 │
     [valid]            [invalid]               │
          │                   │                 │
          │                   └────────┬────────┘
          │                            │
          │                            ▼
          │                  ┌──────────────────┐
          │                  │ fallbackLogin    │
          │                  │ (Key Vault →     │
          │                  │  hard login)     │
          │                  └──────────────────┘
          │                            │
          │                  ┌─────────┴─────────┐
          │                  │                   │
          │                  ▼                   ▼
          │             [success]            [fail]
          │                  │                   │
          │                  │                   ▼
          │                  │             return null
          │                  │
          └──────────────────┴───────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Write temp file      │
                  │ Return { path,       │
                  │   cleanup }          │
                  └──────────────────────┘
```

### Message Polling Flow

```
[UI: Start Polling]
        │
        ▼
[POST /run-message-polling]
        │
        ▼
[getStorageStatePathForSpawnedProcess]
        │
        ▼
[spawn: npx playwright test facebook.message.polling.spec.ts]
        │
        ▼
[Playwright: load storageState, goto facebook.com]
        │
        ├── [on login page + has creds] → hard login
        │
        ▼
[Navigate: shortcuts → Marketplace → Messenger → Marketplace tab]
        │
        ▼
[Collect conversation links from DOM]
        │
        ▼
[For each conversation: extract messages, profile, listing]
        │
        ▼
[POST /api/facebook-messages/process with secret token]
        │
        ▼
[Server: create/update leads, store messages]
```

---

## Summary

- **Auth**: Session-first with encrypted storageState in DB; fallback to Key Vault hard login.
- **Tests**: Three specs for polling, sending, and posting; all use storageState when provided.
- **Execution**: Server spawns Playwright with a temp session file and matching viewport/userAgent.
- **Credentials**: Stored only in Key Vault; DB stores references and encrypted storageState.
