# Facebook Listing Context - COMPLETED ✅

## Problem

The AI leasing agent was giving **generic responses** to Facebook leads asking "Is this available?" instead of confirming availability for the **specific unit** they saw on Facebook Marketplace.

```
Facebook Lead: "Hi, is this available?" [asking about specific Facebook listing]
AI: "We have a 1-bedroom unit available at 123 Main St..." ❌ Generic response

Expected: "Yes! This unit is available for $1,300/month..." ✅ Specific to their inquiry
```

---

## Root Cause

The code to map `facebookListingId` → `propertyId` + `unitId` was deployed, BUT existing Facebook leads were created BEFORE the fix, so they didn't have these fields populated.

**Evidence from logs:**
```
[AI V2] ⚠️  No propertyId detected. Memory state: {}
[AI V2] Classifying message intent... {
  detectedPropertyId: undefined,
  leadPropertyId: null,  // ❌ Lead missing propertyId!
}
```

**Database check showed:**
- ✅ Leads HAD `metadata.facebookListingId`
- ❌ Leads MISSING `propertyId`  
- ❌ Leads MISSING `metadata.unitId`

---

## Solution Applied

### ✅ Step 1: Backfilled Existing Facebook Leads

Created and ran `backfill-facebook-leads.mjs` script:

```javascript
// For each Facebook lead without propertyId:
// 1. Look up listing by facebookListingId
// 2. Get propertyId and unitId from listing
// 3. Update lead.propertyId
// 4. Add unitId to lead.metadata
```

**Result:**
```
✅ Successfully backfilled: 30 leads
❌ Failed: 0 leads
```

**Before:**
```javascript
{
  id: "b9f3cdff-6912-497f-9ee3-1f2eafcddcb7",
  name: "Leonarda Dickey",
  propertyId: null,  // ❌
  metadata: {
    facebookListingId: "638680695215754"
    // unitId missing ❌
  }
}
```

**After:**
```javascript
{
  id: "b9f3cdff-6912-497f-9ee3-1f2eafcddcb7",
  name: "Leonarda Dickey",
  propertyId: "99f8a5ac-f56c-4140-941c-c7e9065e0ccf",  // ✅ Set!
  metadata: {
    facebookListingId: "638680695215754",
    unitId: "76d80370-9bbc-4937-8438-3efa441e9cbf"  // ✅ Added!
  }
}
```

---

### ✅ Step 2: Enhanced AI Prompt for Specific Unit Context

**Updated:** `server/aiReplyGeneratorV2.ts` (~770)

Added context when lead has a specific `unitId` from Facebook listing:

```typescript
// Add context if lead is inquiring about a specific unit (from Facebook listing context)
let leadUnitContext = '';
if (detectedUnitId && lead?.propertyId) {
  leadUnitContext = `\n\nIMPORTANT CONTEXT: This lead is inquiring about a SPECIFIC unit (unitId: ${detectedUnitId}) at a SPECIFIC property (propertyId: ${lead.propertyId}). When they ask "Is this available?", they are asking about THIS SPECIFIC UNIT, not about units in general. Your response should confirm the availability of THIS SPECIFIC UNIT, not list all available units.`;
}
```

**Added to `userPrompt` instructions:**
```
- If this lead has a specific unitId (from Facebook listing context), and they ask "Is this available?", respond about THAT SPECIFIC UNIT only (e.g., "Yes, this unit is available!" or "This unit is currently occupied"), NOT about other available units
```

---

## How It Works Now

### When Facebook Lead is Created:
```
1. Facebook scraper detects message on listing "638680695215754"
   ↓
2. Calls /api/facebook-messages/process with listingId
   ↓
3. Backend looks up listing:
   - storage.getUnitByFacebookListingId("638680695215754", orgId)
   - Returns: { propertyId: "99f8a...", unitId: "76d80..." }
   ↓
4. Creates lead with:
   - propertyId: "99f8a..." ✅
   - metadata.unitId: "76d80..." ✅
   - metadata.facebookListingId: "638680695215754" ✅
```

### When AI Generates Response:
```
1. Lead asks: "Hi, is this available?"
   ↓
2. AI loads lead:
   - lead.propertyId = "99f8a..." ✅
   - lead.metadata.unitId = "76d80..." ✅
   ↓
3. AI detects context (aiReplyGeneratorV2.ts ~196):
   - detectedPropertyId = "99f8a..." (from lead.propertyId)
   - detectedUnitId = "76d80..." (from lead.metadata.unitId)
   ↓
4. AI adds prompt context:
   - "This lead is inquiring about a SPECIFIC unit (unitId: 76d80...)
      When they ask 'Is this available?', they are asking about THIS SPECIFIC UNIT"
   ↓
5. AI calls tool:
   - get_availability({ propertyId: "99f8a..." })
   - Filters to specific unit: "76d80..."
   ↓
6. AI response:
   - "Yes! This unit is available for $1,300/month..." ✅ Specific!
```

---

## Expected Behavior Now

### Facebook Lead: "Is this available?"

**Before Fix:**
```
AI: "Great news! We have a 1-bedroom, 1-bathroom unit available at 123 Main St 
     with a monthly rent of $1,300..."
     
❌ Generic - doesn't acknowledge specific unit they saw
```

**After Fix:**
```
AI: "Yes! This unit is available for $1,300/month. It's a 1-bedroom, 
     1-bathroom unit at 123 Main St. Would you like to schedule a tour?"
     
✅ Specific - confirms THE unit they inquired about
```

---

## Verification

Run the backfill script again to check if any new Facebook leads need backfilling:

```bash
node backfill-facebook-leads.mjs
```

Expected output:
```
Found 0 Facebook leads to backfill
✅ No leads need backfilling!
```

Or create `check-lead.mjs` to inspect a specific lead:
```javascript
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const leadId = 'YOUR_LEAD_ID_HERE';
const result = await pool.query(
  'SELECT id, name, property_id, metadata FROM leads WHERE id = $1',
  [leadId]
);

console.log(JSON.stringify(result.rows[0], null, 2));
await pool.end();
```

---

## Files Modified

1. **`server/storage.ts`** - Added `getUnitByFacebookListingId()` method
2. **`server/routes.ts`** - Updated Facebook lead creation endpoints to map listingId → propertyId + unitId
3. **`server/aiReplyGeneratorV2.ts`** - Added:
   - Detection of `unitId` from `lead.metadata.unitId` (~196)
   - Context in prompt about specific unit inquiry (~770)
   - Instructions to respond about THAT SPECIFIC UNIT (~777)
4. **`migrations/`** - Fixed and ran all migrations (including `019_add_lead_ai_memory.sql`)
5. **`backfill-facebook-leads.mjs`** - Script to backfill existing leads ✅ Ran successfully

---

## Summary

✅ **30 existing Facebook leads backfilled** with `propertyId` and `metadata.unitId`  
✅ **New Facebook leads auto-populate** propertyId and unitId from listing  
✅ **AI detects unit context** from `lead.metadata.unitId`  
✅ **AI responds specifically** about the unit the lead inquired about  
✅ **Memory system works** - conversation context persists  

The AI now knows which specific unit Facebook leads are asking about and responds accordingly! 🎉
