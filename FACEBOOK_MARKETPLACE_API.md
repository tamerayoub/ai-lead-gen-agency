# Facebook Marketplace Integration API

This document describes the new persistent Facebook Marketplace integration endpoints that use server-side session storage (Playwright storageState).

## Overview

The integration saves Facebook sessions on the server using Playwright's `storageState` feature. This includes cookies and localStorage that preserve login sessions across server restarts and page refreshes.

**Key Features:**
- Server-persisted sessions (stored in `./data/facebook/{orgId}.storageState.json`)
- No password storage (password only used during initial login)
- Automatic session verification
- Persistent connection status across refreshes

---

## Endpoints

### 1. GET /api/integrations/facebook/status

Get the current Facebook Marketplace connection status for the authenticated user's organization.

**Response:**
```json
{
  "connected": boolean,
  "lastVerifiedAt": "2026-01-30T01:00:00.000Z" | null,
  "lastError": "error message" | null,
  "accountIdentifier": "User Name" | null
}
```

**Example (curl):**
```bash
curl -X GET http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**Example Response (Connected):**
```json
{
  "connected": true,
  "lastVerifiedAt": "2026-01-30T01:15:32.123Z",
  "lastError": null,
  "accountIdentifier": "John Doe"
}
```

**Example Response (Not Connected):**
```json
{
  "connected": false,
  "lastVerifiedAt": null,
  "lastError": null,
  "accountIdentifier": null
}
```

---

### 2. POST /api/integrations/facebook/connect

Connect to Facebook Marketplace by logging in with Playwright and saving the session.

**Request Body:**
```json
{
  "email": "your-facebook-email@example.com",
  "password": "your-facebook-password"
}
```

**Response:**
```json
{
  "success": boolean,
  "error": "error message" | undefined,
  "accountIdentifier": "User Name" | undefined
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:5000/api/integrations/facebook/connect \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-facebook-email@example.com",
    "password": "your-facebook-password"
  }'
```

**Example Response (Success):**
```json
{
  "success": true,
  "accountIdentifier": "John Doe"
}
```

**Example Response (Failure):**
```json
{
  "success": false,
  "error": "Login failed. Please check your credentials."
}
```

**Notes:**
- Password is **not** stored; only used for login
- After successful login, a storageState file is saved to `./data/facebook/{orgId}.storageState.json`
- Integration status is updated in the database

---

### 3. POST /api/integrations/facebook/verify

Verify that the saved Facebook session is still valid.

**Request Body:** (none)

**Response:**
```json
{
  "success": boolean,
  "error": "error message" | undefined
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:5000/api/integrations/facebook/verify \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**Example Response (Valid Session):**
```json
{
  "success": true
}
```

**Example Response (Expired Session):**
```json
{
  "success": false,
  "error": "Session expired. Please reconnect."
}
```

**Notes:**
- Loads the saved storageState and navigates to Facebook Marketplace
- If redirected to login page, session is considered expired
- Updates the integration status in the database

---

### 4. POST /api/integrations/facebook/disconnect

Disconnect from Facebook Marketplace by deleting the saved session.

**Request Body:** (none)

**Response:**
```json
{
  "success": boolean
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:5000/api/integrations/facebook/disconnect \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true
}
```

**Notes:**
- Deletes the storageState file from `./data/facebook/{orgId}.storageState.json`
- Updates integration status to disconnected in the database

---

## Frontend Integration

The frontend should:

1. **On mount:** Call `GET /api/integrations/facebook/status` to get current status
2. **Display UI:** Show "Connected" or "Not Connected" based on `status.connected`
3. **On connect:** Call `POST /api/integrations/facebook/connect` with credentials
4. **After connect:** Refetch status to update UI
5. **On disconnect:** Call `POST /api/integrations/facebook/disconnect`
6. **Optional:** Periodically call `POST /api/integrations/facebook/verify` to check session validity

### Example React Component Usage

```tsx
import { FacebookMarketplaceIntegration } from "@/components/FacebookMarketplaceIntegration";

function IntegrationsPage() {
  return (
    <div>
      <h1>Integrations</h1>
      <FacebookMarketplaceIntegration />
    </div>
  );
}
```

The `FacebookMarketplaceIntegration` component:
- Fetches status on mount
- Shows connection status with last verified time
- Allows connecting/disconnecting
- Handles loading and error states
- Persists status across page refreshes (server-side persistence)

---

## Storage Structure

### Database (integration_config table)

```json
{
  "service": "facebook-marketplace",
  "orgId": "org-uuid",
  "config": {
    "connected": true,
    "lastVerifiedAt": "2026-01-30T01:15:32.123Z",
    "lastError": null,
    "accountIdentifier": "John Doe"
  },
  "isActive": true
}
```

### File System (./data/facebook/{orgId}.storageState.json)

```json
{
  "cookies": [
    {
      "name": "c_user",
      "value": "...",
      "domain": ".facebook.com",
      "path": "/",
      "expires": 1738368000,
      "httpOnly": false,
      "secure": true,
      "sameSite": "None"
    },
    ...
  ],
  "origins": [
    {
      "origin": "https://www.facebook.com",
      "localStorage": [
        {
          "name": "some_key",
          "value": "some_value"
        },
        ...
      ]
    }
  ]
}
```

---

## Security Notes

1. **Password Handling:**
   - Password is **never** stored in the database or filesystem
   - Only used during the initial login process
   - Immediately discarded after session is saved

2. **StorageState Security:**
   - StorageState files contain session cookies (equivalent to being logged in)
   - Files are stored in `./data/facebook/` with restricted access
   - Each organization has a separate storageState file
   - Files should be backed up securely if deploying to production

3. **Session Verification:**
   - Sessions can expire (Facebook typically expires after ~60 days of inactivity)
   - Use `POST /api/integrations/facebook/verify` to check validity
   - If expired, user must reconnect

4. **Production Considerations:**
   - Ensure `./data/facebook/` directory has proper file permissions (readable only by app)
   - Consider encrypting storageState files at rest
   - Implement rate limiting on connect endpoint to prevent brute force
   - Add CAPTCHA handling if needed (Facebook may show CAPTCHA for suspicious logins)

---

## Troubleshooting

### "Session expired" error

**Cause:** Facebook session has expired (typically after 60 days of inactivity).

**Solution:** Disconnect and reconnect to create a new session.

### "Login requires verification (CAPTCHA or 2FA)"

**Cause:** Facebook detected suspicious activity and requires additional verification.

**Solution:** 
1. Log in to Facebook in a regular browser first
2. Complete any CAPTCHA or 2FA challenges
3. Then try connecting again in the app

### Connection status not persisting after refresh

**Cause:** Frontend is not fetching status from server on mount.

**Solution:** Ensure `GET /api/integrations/facebook/status` is called when the page loads.

### "Could not access Marketplace" error

**Cause:** Facebook account may not have Marketplace access, or there's a temporary Facebook issue.

**Solution:** 
1. Verify account can access Marketplace in a regular browser
2. Try reconnecting
3. Check Facebook's status page for outages

---

## Migration from Old Integration

If you have an existing Facebook Marketplace integration using the old approach (storing email/password):

1. **Disconnect old integration** using the old `/api/integrations/facebook-marketplace/disconnect` endpoint
2. **Connect using new endpoint** at `/api/integrations/facebook/connect`
3. **Update frontend** to use new `/api/integrations/facebook/status` endpoint
4. **Remove references** to `/api/integrations/facebook-marketplace` (legacy endpoints)

The new integration is backward compatible—legacy endpoints still work but use the old approach (no persistent sessions).

---

## Testing

### Test Connection Flow

```bash
# 1. Check initial status (should be disconnected)
curl -X GET http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie"

# 2. Connect
curl -X POST http://localhost:5000/api/integrations/facebook/connect \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-facebook-email@example.com",
    "password": "your-facebook-password"
  }'

# 3. Verify status is now connected
curl -X GET http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie"

# 4. Verify session is valid
curl -X POST http://localhost:5000/api/integrations/facebook/verify \
  -H "Cookie: your-session-cookie"

# 5. Disconnect
curl -X POST http://localhost:5000/api/integrations/facebook/disconnect \
  -H "Cookie: your-session-cookie"

# 6. Verify status is now disconnected
curl -X GET http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie"
```

---

## Summary

The new Facebook Marketplace integration provides:
- ✅ Server-side session persistence (survives page refreshes)
- ✅ No password storage (password only used during login)
- ✅ Automatic session verification
- ✅ Robust error handling
- ✅ Clean separation between frontend state and server state
- ✅ Backward compatible with legacy endpoints

Frontend shows "Connected" only when server says `connected: true`, ensuring UI always reflects actual connection status.
