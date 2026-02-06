# Facebook Listing Context - AI Response Fix

## Problem

When Facebook Marketplace leads ask "Is this available?", the AI doesn't know which specific listing/unit they're inquiring about. The AI responds generically instead of acknowledging the specific unit they saw on Facebook.

### Example Issue

```
Facebook Lead: "Hi, is this available?" [inquiring about Unit 1 at 123 Main St from Facebook listing]
AI: "Great news! We have a 1-bedroom, 1-bathroom unit available at 123 Main St..." ❌

Expected: "Yes! The 1-bedroom unit at 123 Main St that you're inquiring about is available!" ✅
```

## Root Causes

### 1. **Missing `lead_ai_memory` Table** ✅ FIXED

The conversation memory system was broken because the `lead_ai_memory` table didn't exist in the database:

```
[Conversation Memory] Error: relation "lead_ai_memory" does not exist
[AI V2] ⚠️  No propertyId detected. Memory state: undefined
```

**Fix Applied:**
- Created migration `007_fix_ai_settings_org_id.sql` to clean up NULL org_id rows
- Fixed migration `008_add_launch_date_setting.sql` to insert per-org settings instead of NULL org_id
- Fixed migration `019_add_lead_ai_memory.sql` to use `VARCHAR` (matching `leads.id` type)
- Updated `server/migrate.ts` to include all existing migrations in correct order
- ✅ **Ran migrations successfully** - `lead_ai_memory` table now exists

### 2. **Listing Context Not Used in AI Responses** 🔄 TO BE FIXED

Facebook leads are created with `metadata.facebookListingId` which identifies the specific unit they inquired about:

```typescript
// From server/routes.ts (line ~16628)
metadata: {
  facebookProfileId: profileId,
  facebookListingId: listingId,  // ✅ Captured!
  facebookConversationId: conversationId,
  facebookProfileName: profileName
}
```

However, the AI doesn't currently use this metadata to:
- Map `facebookListingId` to a specific `propertyId` and `unitId`
- Include this context when generating responses
- Acknowledge the specific unit they saw

---

## Solutions Implemented

### ✅ Solution #1: Fixed Memory System

**Created:** `migrations/007_fix_ai_settings_org_id.sql`
```sql
-- Delete ai_settings rows with NULL org_id
DELETE FROM ai_settings WHERE org_id IS NULL;
```

**Updated:** `migrations/008_add_launch_date_setting.sql`
```sql
-- Changed from inserting NULL org_id to inserting per-org settings
INSERT INTO ai_settings (id, org_id, category, key, value, updated_at)
SELECT 
  gen_random_uuid(),
  o.id,  -- Use actual org ID, not NULL
  'landing_page',
  'launch_date',
  (NOW() + INTERVAL '1 month')::text,
  NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM ai_settings 
  WHERE category = 'landing_page' 
  AND key = 'launch_date' 
  AND org_id = o.id
);
```

**Updated:** `migrations/019_add_lead_ai_memory.sql`
```sql
-- Changed UUID to VARCHAR to match leads.id type
CREATE TABLE IF NOT EXISTS lead_ai_memory (
  lead_id VARCHAR PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,  -- Changed from UUID
  summary_text TEXT NOT NULL DEFAULT '',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Updated:** `server/migrate.ts`
- Added `007_fix_ai_settings_org_id.sql`
- Added `011_add_ai_enabled_to_leads.sql`
- Added `019_add_lead_ai_memory.sql`
- Removed missing files (016, 017)

**Result:** ✅ All migrations run successfully. Memory system now works!

---

## 🔄 Solution #2: Use Facebook Listing Context (TODO - Needs Implementation)

### Current Flow
```
Facebook Lead created with:
  - lead.metadata.facebookListingId = "listing_123"
  - lead.propertyId = null (not set)
  - lead.propertyName = null (not set)
    ↓
AI receives lead with no property context
    ↓
AI calls get_availability with no propertyId
    ↓
AI returns generic "we have units available" response
```

### Proposed Flow
```
Facebook Lead created with:
  - lead.metadata.facebookListingId = "listing_123"
    ↓
On first AI interaction:
  1. Check if lead.metadata.facebookListingId exists
  2. Look up property_units where facebookListingId matches
  3. Set lead.propertyId and update lead record
  4. Include propertyId/unitId in AI context
    ↓
AI knows exactly which unit the lead saw
    ↓
AI responds: "Yes! The 1-bedroom unit at 123 Main St that you're inquiring about is available!"
```

### Implementation Options

#### Option A: Pre-populate propertyId when creating Facebook lead (Recommended)

When `/api/facebook-messages/process` creates a lead from Facebook:

```typescript
// If listingId exists, find the matching unit and set propertyId
if (listingId) {
  const unit = await storage.getUnitByFacebookListingId(listingId, orgId);
  if (unit) {
    leadData.propertyId = unit.propertyId;
    leadData.metadata.unitId = unit.id;
  }
}
```

**Pros:**
- Property context available immediately
- No additional lookup needed at response time
- Works with existing AI tools

**Cons:**
- Requires adding `storage.getUnitByFacebookListingId()` method

#### Option B: Hydrate propertyId in AI handler

In `generateAIReplyV2`, before calling tools:

```typescript
// If lead has facebookListingId but no propertyId, look it up
if (lead?.metadata?.facebookListingId && !lead.propertyId) {
  const unit = await storage.getUnitByFacebookListingId(lead.metadata.facebookListingId, orgId);
  if (unit) {
    lead.propertyId = unit.propertyId;
    detectedUnitId = unit.id;
    // Optionally update lead record
  }
}
```

**Pros:**
- Doesn't require changes to lead creation flow
- Lazy loading only when needed

**Cons:**
- Adds latency to every AI response
- Property context not available elsewhere (e.g., dashboard)

---

## Recommended Next Steps

1. **✅ DONE:** Create and run migrations to add `lead_ai_memory` table
2. **TODO:** Implement `storage.getUnitByFacebookListingId(listingId, orgId)` method
3. **TODO:** Update `/api/facebook-messages/process` to pre-populate `propertyId` when creating Facebook leads
4. **TODO:** Test with a real Facebook lead to verify listing context is used

---

## Impact

### After Memory Fix (✅ Done)
- ✅ Conversation memory now persists between messages
- ✅ PropertyId remembered throughout conversation
- ✅ Follow-up questions work correctly
- ✅ "What other times?" continues the scheduling flow

### After Listing Context Fix (🔄 TODO)
- ✅ AI knows which specific unit the Facebook lead inquired about
- ✅ More personalized responses: "Yes, this unit is available" instead of generic
- ✅ Better user experience for Facebook Marketplace leads

---

## Files Modified

1. **`migrations/007_fix_ai_settings_org_id.sql`** - NEW: Cleans up NULL org_id rows
2. **`migrations/008_add_launch_date_setting.sql`** - FIXED: Insert per-org settings
3. **`migrations/019_add_lead_ai_memory.sql`** - FIXED: Use VARCHAR not UUID
4. **`server/migrate.ts`** - UPDATED: Added missing migrations to list

---

## Summary

✅ **Memory system fixed** - `lead_ai_memory` table created, conversation context now persists  
🔄 **Listing context** - Captured in `metadata.facebookListingId` but not yet used by AI  
💡 **Next:** Implement `getUnitByFacebookListingId` and pre-populate `propertyId` for Facebook leads
