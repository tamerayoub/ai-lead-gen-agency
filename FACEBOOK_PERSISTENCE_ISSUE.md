# Facebook Marketplace Persistence Issue - Root Cause & Solution

## 🔍 Problem Identified

You're using the **LEGACY endpoints** which do NOT implement storageState persistence!

### What's Happening Now (LEGACY)

```
Frontend calls: /api/integrations/facebook-marketplace/test
               /api/integrations/facebook-marketplace/configure
                ↓
Backend: Runs Playwright test
Backend: Saves email/password to DB
Backend: ❌ Does NOT save storageState
Backend: ❌ Does NOT implement persistence
                ↓
Result: Connection works but status doesn't persist after refresh
```

### What Should Happen (NEW)

```
Frontend calls: /api/integrations/facebook/connect
                ↓
Backend: Runs Playwright login
Backend: Saves storageState to ./data/facebook/{orgId}.storageState.json
Backend: Updates DB with status
                ↓
Result: Connection persists across refreshes ✅
```

---

## 📊 Current State

From your logs:
```
[Facebook Marketplace Test] ✅ Login successful
POST /api/integrations/facebook-marketplace/test 200 in 61846ms

[Facebook Marketplace Configure] ✅ Credentials saved to database
POST /api/integrations/facebook-marketplace/configure 200
```

**This is using the OLD system!** The OLD system:
- ✅ Tests connection with Playwright
- ✅ Saves email/password to database
- ❌ Does NOT save storageState (the actual session)
- ❌ Does NOT persist across refreshes

---

## 🔧 Solution: Use the NEW Endpoints

### Option 1: Quick Fix (Update Frontend to Call New Endpoints)

Update `client/src/pages/Integrations.tsx` to call the NEW endpoints:

**Change FROM (LEGACY):**
```typescript
// OLD - Does not persist
await apiRequest("POST", "/api/integrations/facebook-marketplace/test", {
  email, password
});
await apiRequest("POST", "/api/integrations/facebook-marketplace/configure", {
  email, password
});
```

**Change TO (NEW with persistence):**
```typescript
// NEW - Persists with storageState
await apiRequest("POST", "/api/integrations/facebook/connect", {
  email, password
});
```

### Option 2: Use the New Component (Recommended)

Replace the old Facebook Marketplace integration UI with the new component:

```tsx
import { FacebookMarketplaceIntegration } from "@/components/FacebookMarketplaceIntegration";

// In your Integrations page:
<FacebookMarketplaceIntegration />
```

This component already uses the new endpoints and handles everything correctly.

---

## 🔍 Debug Logs Added

I've added comprehensive logging to help debug. You'll now see:

**For NEW endpoints:**
```
[Facebook Connect NEW] ===== CONNECT REQUEST =====
[Facebook Connect NEW] Starting Playwright connection...
[Facebook Connect NEW] Connection result: { success: true, ... }
[Facebook Connect NEW] ✅ Connection successful
```

**For LEGACY endpoints (warning):**
```
[Facebook Marketplace Test LEGACY] ⚠️  WARNING: Using LEGACY endpoint
[Facebook Marketplace Configure LEGACY] ⚠️  This endpoint stores email/password in DB but does NOT use storageState persistence
```

---

## 📝 Quick Test

### Test the NEW endpoint (with persistence):

```bash
curl -X POST http://localhost:5000/api/integrations/facebook/connect \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com", "password": "your-password"}'
```

**Expected logs:**
```
[Facebook Connect NEW] ===== CONNECT REQUEST =====
[Facebook Marketplace Connect] Starting connection for org...
[Facebook Marketplace Connect] Login successful, saving session...
[Facebook Marketplace Connect] StorageState saved for org...
[Facebook Marketplace Connect] ✅ Successfully connected
```

### Then check status:

```bash
curl http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie"
```

**Expected response:**
```json
{
  "connected": true,
  "lastVerifiedAt": "2026-01-30T...",
  "accountIdentifier": "Your Name"
}
```

### Refresh page and check status again:

```bash
# Same curl command - status should STILL be connected
curl http://localhost:5000/api/integrations/facebook/status \
  -H "Cookie: your-session-cookie"
```

**Result:** Status persists because storageState is saved to disk ✅

---

## 🎯 Summary

| Endpoint | Persists? | How? |
|----------|-----------|------|
| **LEGACY:** `/api/integrations/facebook-marketplace/*` | ❌ No | Saves email/password only |
| **NEW:** `/api/integrations/facebook/*` | ✅ Yes | Saves storageState to disk |

### To Fix:
1. Update frontend to call `/api/integrations/facebook/connect` instead of legacy endpoints
2. OR use the new `FacebookMarketplaceIntegration` component
3. Watch logs for `[Facebook Connect NEW]` vs `[Facebook Marketplace Test LEGACY]`

### Files to Update:
- `client/src/pages/Integrations.tsx` - Change API calls from `/facebook-marketplace/*` to `/facebook/*`
- OR replace with `<FacebookMarketplaceIntegration />` component

Once you make this change, connection status will persist across refreshes! 🎉
