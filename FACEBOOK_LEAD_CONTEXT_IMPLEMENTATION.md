# Facebook Lead Context - Implementation Summary

## Problem Solved

When Facebook Marketplace leads asked "Is this available?", the AI didn't know which specific unit they were inquiring about, leading to generic responses instead of personalized answers about the exact listing they saw.

## Root Causes & Solutions

### ✅ Issue #1: Missing `lead_ai_memory` Table (CRITICAL - FIXED)

**Problem:**
```
[Conversation Memory] Error: relation "lead_ai_memory" does not exist
[AI V2] ⚠️  No propertyId detected. Memory state: undefined
```

**Impact:**
- ❌ Memory couldn't be saved/loaded
- ❌ PropertyId lost after each message  
- ❌ AI treated each message as a fresh conversation
- ❌ Follow-up questions didn't work

**Solution:**

1. **Created `migrations/007_fix_ai_settings_org_id.sql`**
   - Deletes `ai_settings` rows with NULL `org_id` (violates schema constraint)

2. **Fixed `migrations/008_add_launch_date_setting.sql`**
   - Changed from inserting NULL `org_id` to inserting per-organization settings:
   ```sql
   -- OLD (causes error)
   INSERT INTO ai_settings (..., org_id, ...) VALUES (..., NULL, ...)
   
   -- NEW (works)
   INSERT INTO ai_settings (..., org_id, ...)
   SELECT ..., o.id, ...  -- Use actual org ID
   FROM organizations o
   ```

3. **Fixed `migrations/019_add_lead_ai_memory.sql`**
   - Changed `lead_id` type from `UUID` to `VARCHAR` to match `leads.id` type:
   ```sql
   -- OLD (type mismatch error)
   lead_id UUID PRIMARY KEY REFERENCES leads(id)
   
   -- NEW (matches leads.id type)
   lead_id VARCHAR PRIMARY KEY REFERENCES leads(id)
   ```

4. **Updated `server/migrate.ts`**
   - Added `007_fix_ai_settings_org_id.sql`
   - Added `019_add_lead_ai_memory.sql`
   - Removed missing migration files (016, 017)

5. **✅ Ran migrations successfully**
   ```
   ✅ Migration 019_add_lead_ai_memory.sql completed successfully!
   ✅ All migrations completed successfully!
   ```

**Result:** Memory system now works! PropertyId persists throughout conversations.

---

### ✅ Issue #2: Facebook Listing Context Not Used (FIXED)

**Problem:**

Facebook leads were created with `metadata.facebookListingId` but the AI didn't map this to a specific property/unit, so it gave generic responses:

```
Facebook Lead: "Hi, is this available?" [asking about Unit 1 at 123 Main St from Facebook listing]
AI: "Great news! We have a 1-bedroom unit available at 123 Main St..." ❌
    ^ Generic response, doesn't acknowledge the specific unit they saw

Expected: "Yes! The unit at 123 Main St that you're inquiring about is available!" ✅
```

**Solution:**

#### 1. **Added `getUnitByFacebookListingId()` method** (`server/storage.ts`)

```typescript
async getUnitByFacebookListingId(
  facebookListingId: string, 
  orgId: string
): Promise<(PropertyUnit & { propertyId: string }) | undefined> {
  // Join listings -> property_units to find the unit
  const result = await db
    .select({ unit: propertyUnits })
    .from(listings)
    .innerJoin(propertyUnits, eq(listings.unitId, propertyUnits.id))
    .where(and(
      eq(listings.facebookListingId, facebookListingId),
      eq(listings.orgId, orgId)
    ))
    .limit(1);
  
  if (!result[0]) return undefined;
  return result[0].unit;
}
```

**What it does:**
- Looks up the `listings` table by `facebookListingId`
- Joins to `property_units` to get the full unit record
- Returns `{ ...unit, propertyId, id (unitId) }`

#### 2. **Updated `/api/leads/for-facebook` endpoint** (`server/routes.ts` ~16173)

```typescript
// Look up property/unit from Facebook listing ID if provided
let propertyIdFromListing: string | undefined;
let unitIdFromListing: string | undefined;

if (facebookListingId) {
  const unit = await storage.getUnitByFacebookListingId(facebookListingId, orgId);
  if (unit) {
    propertyIdFromListing = unit.propertyId;
    unitIdFromListing = unit.id;
    console.log(`[Leads/Facebook] 🔍 Mapped listing ID to property: ${unit.propertyId}, unit: ${unit.id}`);
  }
}

// When creating new lead:
const leadData: any = {
  // ...
  propertyId: propertyIdFromListing || null,  // ✅ Set from listing
  metadata: {
    facebookProfileId: profileId,
    facebookListingId,
    unitId: unitIdFromListing,  // ✅ Store unitId in metadata
  },
};

// When updating existing lead:
if (propertyIdFromListing && !lead.propertyId) {
  updates.propertyId = propertyIdFromListing;  // ✅ Backfill propertyId
}
```

#### 3. **Updated `/api/facebook-messages/process` endpoint** (`server/routes.ts` ~16660)

Same changes as above:
- Looks up unit by `facebookListingId`
- Sets `lead.propertyId` when creating new leads
- Backfills `lead.propertyId` for existing leads
- Stores `unitId` in `metadata.unitId`

#### 4. **Enhanced AI to use unitId from metadata** (`server/aiReplyGeneratorV2.ts` ~196)

```typescript
// For Facebook leads, check metadata for unitId (from facebookListingId mapping)
if (lead?.metadata && typeof lead.metadata === 'object') {
  const metadata = lead.metadata as any;
  if (metadata.unitId && !detectedUnitId) {
    detectedUnitId = metadata.unitId;
    console.log(`[AI V2] ✅ Using unitId from lead metadata (Facebook listing context): ${detectedUnitId}`);
  }
}
```

**What this does:**
- When AI generates a response, it checks `lead.metadata.unitId`
- If found, uses it as the `detectedUnitId`
- Tools like `get_availability`, `get_tour_slots`, `quote_price` receive the specific unitId
- AI can acknowledge the exact unit the lead inquired about

---

## New Flow (After Fixes)

### Facebook Lead Creation:
```
1. Facebook scraper detects message on listing "listing_123"
   ↓
2. Calls /api/facebook-messages/process with:
   - profileId: "facebook_user_456"
   - listingId: "listing_123"
   ↓
3. Backend looks up listing in database:
   - storage.getUnitByFacebookListingId("listing_123", orgId)
   - Returns: { id: "unit-abc", propertyId: "prop-xyz" }
   ↓
4. Creates/updates lead with:
   - propertyId: "prop-xyz" ✅
   - metadata: { 
       facebookListingId: "listing_123",
       unitId: "unit-abc" ✅
     }
   ↓
5. Lead now has full context!
```

### AI Response Generation:
```
1. Lead asks: "Hi, is this available?"
   ↓
2. AI loads lead:
   - lead.propertyId = "prop-xyz" ✅
   - lead.metadata.unitId = "unit-abc" ✅
   ↓
3. AI detects context:
   - detectedPropertyId = "prop-xyz" (from lead.propertyId)
   - detectedUnitId = "unit-abc" (from lead.metadata.unitId)
   ↓
4. AI calls tool:
   - get_availability({ propertyId: "prop-xyz" })
   - OR get_tour_slots({ propertyId: "prop-xyz", unitId: "unit-abc" })
   ↓
5. AI knows exactly which unit they're asking about!
   ↓
6. Response: "Yes! The 1-bedroom unit at 123 Main St that you're inquiring about is available!" ✅
```

---

## Expected Behavior

### Before Fixes:
```
Facebook Lead: "Is this available?"
AI: "We have a 1-bedroom unit at 123 Main St available..." ❌ Generic

Lead: "Who is the company?"
AI: "I don't have the specific names..." ❌ No org/agent info

Lead: "What other times are available?"
AI: "Which property?" ❌ Memory lost
```

### After Fixes:
```
Facebook Lead: "Is this available?" [lead.propertyId + metadata.unitId set from listing]
AI: "Yes! The 1-bedroom unit at 123 Main St is available for $1,300/month..." ✅ Specific

Lead: "Who is the company?"
AI: "123 Main St is managed by New ORG. Your tour would be conducted by Tamer Ayubb." ✅ Has info

Lead: "What other times are available?"
AI: "We have availability on Monday, Feb 2 (9 AM - 12 PM), Feb 9 (9 AM - 12 PM)..." ✅ Remembers property
```

---

## Files Modified

### Database & Migrations
1. **`migrations/007_fix_ai_settings_org_id.sql`** - NEW: Clean up NULL org_id rows
2. **`migrations/008_add_launch_date_setting.sql`** - FIXED: Per-org settings instead of NULL
3. **`migrations/019_add_lead_ai_memory.sql`** - FIXED: Use VARCHAR not UUID
4. **`server/migrate.ts`** - UPDATED: Added missing migrations

### Storage Layer
5. **`server/storage.ts`** - ADDED:
   - `getUnitByFacebookListingId()` method to IStorage interface
   - Implementation in DatabaseStorage class

### API Endpoints
6. **`server/routes.ts`** - UPDATED:
   - `/api/leads/for-facebook`: Look up unit from listingId, set propertyId
   - `/api/facebook-messages/process`: Look up unit from listingId, set propertyId + metadata.unitId

### AI System
7. **`server/aiReplyGeneratorV2.ts`** - UPDATED:
   - Check `lead.metadata.unitId` for Facebook listing context
   - Use it as `detectedUnitId` for tool calls

### Tools & Routing
8. **`server/aiTools.ts`** - ADDED:
   - `getPropertyContactInfo()` function
   - Tool definition for `get_property_contact_info`
   - Case in `executeTool` switch

9. **`server/aiRouter.ts`** - UPDATED:
   - Added `contact_info` intent to MessageIntent type
   - Added classification rules and examples for company/agent questions

10. **`server/aiToolPlanning.ts`** - UPDATED:
    - Added case for `contact_info` intent

---

## Testing

### Test Scenario 1: Facebook Lead with Listing Context
1. Import a listing to Facebook Marketplace (or use existing)
2. Message through Facebook: "Is this available?"
3. **Check logs:** Should see `[Leads/Facebook] 🔍 Mapped listing ID to property: xxx, unit: yyy`
4. **Expected:** AI responds specifically about that unit (not generic)

### Test Scenario 2: Memory Persistence
1. Ask: "How can I schedule a tour?"
2. AI responds with times
3. Ask: "That day doesn't work, what other times?"
4. **Expected:** AI continues with same property (no "Which property?" question)

### Test Scenario 3: Company/Agent Info
1. Ask: "Who is the company and leasing agent?"
2. **Expected:** AI says organization name and assigned member name(s)

---

## Logs to Watch For

### Good Signs ✅
```
[Storage] getUnitByFacebookListingId called: { facebookListingId: 'xxx', orgId: 'yyy' }
[Storage] Found unit for Facebook listing: 1 property: e6aa181e-03ae-4b72-9310-7fe1c59f9abd
[Leads/Facebook] 🔍 Mapped listing ID to property: xxx, unit: yyy
[Leads/Facebook] Setting propertyId from listing: xxx
[AI V2] ✅ Using unitId from lead metadata (Facebook listing context): yyy
[AI V2] ✅ Using propertyId from conversation memory: xxx
```

### Bad Signs ❌
```
[Conversation Memory] Error: relation "lead_ai_memory" does not exist
[AI V2] ⚠️  No propertyId detected. Memory state: undefined
[Storage] No unit found for Facebook listing ID: xxx
```

---

## Summary

✅ **Memory system fixed** - `lead_ai_memory` table created, migrations run successfully  
✅ **Listing context captured** - Facebook listingId → propertyId + unitId mapping  
✅ **AI uses listing context** - Detects unitId from `lead.metadata.unitId`  
✅ **Company/agent info** - New `get_property_contact_info` tool provides org name and assigned members  

The AI leasing agent now:
- Remembers property/unit throughout conversations
- Knows which specific unit Facebook leads are asking about
- Can answer "who is the company?" and "who will show me the property?"
- Provides personalized responses based on exact listing context
