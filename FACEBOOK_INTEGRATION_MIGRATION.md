# Facebook Marketplace Integration - Frontend Migration

## Problem

The "Connected" UI status was not showing after successfully connecting to Facebook Marketplace.

### Root Cause

**Frontend and Backend were using different systems:**

- **Frontend:** Called LEGACY endpoints (`/api/integrations/facebook-marketplace/*`)
- **LEGACY Backend:** Saved credentials to `integration_credentials` table (no storageState)
- **NEW Backend:** Uses `integration_config` table + storageState files for persistence
- **Result:** Connection succeeded but UI didn't recognize it because it checked the wrong table

### The Mismatch

```
User clicks "Connect"
    ↓
Frontend calls: /api/integrations/facebook-marketplace/test (LEGACY)
                /api/integrations/facebook-marketplace/configure (LEGACY)
    ↓
Backend saves to: integration_credentials table (LEGACY)
    ↓
Frontend checks: /api/integrations/facebook-marketplace (LEGACY)
    ↓
Backend returns: { connected: true } from integration_credentials
    ↓
BUT: No storageState saved, session doesn't persist across refreshes ❌
```

---

## Solution: Migrate Frontend to NEW Persistent Endpoints

Updated the frontend to use the NEW endpoints that support persistent sessions via storageState.

### Changes Made

**File:** `client/src/pages/Integrations.tsx`

#### 1. Updated Status Check Query (Line ~274)

**Before (LEGACY):**
```typescript
const { data: facebookMarketplaceConfig, ... } = useQuery<any>({ 
  queryKey: ["/api/integrations/facebook-marketplace"],
  queryFn: async () => {
    const response = await fetch(`/api/integrations/facebook-marketplace`, { 
      credentials: "include",
    });
    // ...
  }
});
```

**After (NEW):**
```typescript
const { data: facebookMarketplaceConfig, ... } = useQuery<any>({ 
  queryKey: ["/api/integrations/facebook/status"],
  queryFn: async () => {
    console.log('[Facebook Marketplace Query NEW] ===== Fetching from NEW API =====');
    const response = await fetch(`/api/integrations/facebook/status`, { 
      credentials: "include",
    });
    // ...
  }
});
```

#### 2. Updated Connect Function (Line ~822)

**Before (LEGACY):**
```typescript
const configureFacebookMarketplaceMutation = useMutation({
  mutationFn: async () => {
    // Test connection
    const testResponse = await apiRequest("POST", "/api/integrations/facebook-marketplace/test", {
      email: facebookMarketplaceEmail,
      password: facebookMarketplacePassword,
    });
    
    // Then configure (save credentials)
    return apiRequest("POST", "/api/integrations/facebook-marketplace/configure", {
      email: facebookMarketplaceEmail,
      password: facebookMarketplacePassword,
    });
  },
  // ...
});
```

**After (NEW):**
```typescript
const configureFacebookMarketplaceMutation = useMutation({
  mutationFn: async () => {
    // Use NEW persistent endpoint that saves storageState
    console.log('[Facebook Marketplace NEW] Connecting with persistent session...');
    const connectResponse = await apiRequest("POST", "/api/integrations/facebook/connect", {
      email: facebookMarketplaceEmail,
      password: facebookMarketplacePassword,
    });
    
    // Connection successful - storageState is saved on server
    console.log('[Facebook Marketplace NEW] ✅ Connected successfully with persistent session');
    return connectResponse;
  },
  // ...
});
```

#### 3. Updated Disconnect Function (Line ~899)

**Before (LEGACY):**
```typescript
const disconnectFacebookMarketplaceMutation = useMutation({
  mutationFn: async () => {
    const response = await apiRequest("POST", "/api/integrations/facebook-marketplace/disconnect", {});
    return response.json();
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook-marketplace"] });
    // ...
  }
});
```

**After (NEW):**
```typescript
const disconnectFacebookMarketplaceMutation = useMutation({
  mutationFn: async () => {
    const response = await apiRequest("POST", "/api/integrations/facebook/disconnect", {});
    return response.json();
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
    // ...
  }
});
```

#### 4. Updated Cache Invalidation (Multiple locations)

Changed all query cache keys from:
- `["/api/integrations/facebook-marketplace"]` (LEGACY)

To:
- `["/api/integrations/facebook/status"]` (NEW)

---

## New Flow (After Migration)

```
User clicks "Connect"
    ↓
Frontend calls: /api/integrations/facebook/connect (NEW ✅)
    ↓
Backend:
  1. Runs Playwright login
  2. Saves storageState to ./data/facebook/{orgId}.storageState.json
  3. Updates integration_config table: { connected: true, lastVerifiedAt: now }
    ↓
Frontend checks: /api/integrations/facebook/status (NEW ✅)
    ↓
Backend returns: { connected: true, lastVerifiedAt: "2026-01-30T..." }
    ↓
UI shows: "Connected" badge ✅
    ↓
After refresh: Session persists because storageState is on disk ✅
```

---

## Testing

### 1. Connect Flow
1. Open Integrations page
2. Click "Connect" on Facebook Marketplace
3. Enter email/password
4. Click "Save and Test Connection"
5. **Expected:** "Connected" badge appears immediately ✅
6. **Check logs:** Should see `[Facebook Marketplace NEW]` messages

### 2. Persistence Test
1. After connecting, refresh the page
2. **Expected:** "Connected" badge still shows ✅
3. **Check logs:** Status fetched from `/api/integrations/facebook/status`

### 3. Disconnect Flow
1. Click "Disconnect"
2. Confirm disconnect
3. **Expected:** "Connected" badge disappears ✅
4. **Check logs:** Status updated via `/api/integrations/facebook/disconnect`

---

## Backend Endpoints Used

| Endpoint | Method | Purpose | Persists Session? |
|----------|--------|---------|-------------------|
| `/api/integrations/facebook/status` | GET | Check connection status | N/A (read-only) |
| `/api/integrations/facebook/connect` | POST | Login and save session | ✅ Yes (storageState) |
| `/api/integrations/facebook/verify` | POST | Verify existing session | ✅ Updates status |
| `/api/integrations/facebook/disconnect` | POST | Disconnect and delete session | N/A (cleanup) |

---

## LEGACY Endpoints (No Longer Used)

These endpoints are still in the codebase but **NOT used by the frontend anymore:**

- `/api/integrations/facebook-marketplace` (GET)
- `/api/integrations/facebook-marketplace/test` (POST)
- `/api/integrations/facebook-marketplace/configure` (POST)
- `/api/integrations/facebook-marketplace/disconnect` (POST)

You can safely remove these if no other code uses them, or keep them for backward compatibility.

---

## Benefits

✅ **Persistent Sessions:** storageState saved to disk survives server restarts  
✅ **Correct Status:** UI correctly reflects connection state from `integration_config` table  
✅ **No Credentials in DB:** Only storageState saved, not raw password  
✅ **Session Verification:** Can verify session validity with `/verify` endpoint  
✅ **Better UX:** "Connected" badge persists across page refreshes  

---

## Summary

Migrated frontend from LEGACY endpoints (credentials-only) to NEW endpoints (persistent storageState). The "Connected" status now shows correctly and persists across refreshes.

**Next time you connect:**
- Click "Connect" on Facebook Marketplace
- Enter credentials
- UI will immediately show "Connected" ✅
- Refresh page → Still connected ✅
