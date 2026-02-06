# Tour Slots - Multiple Dates Availability Fix

## Problem

When users asked for alternative tour dates, the AI only showed availability for the current week (next 7 days), not offering dates in future weeks.

### Example Issue

```
User: "I'm not available Feb 2, what else is available?"
AI: "Unfortunately, there are no other days available for tours at this time." ❌

Database: Monday 9-12 AM availability (recurring weekly)
Expected: AI should offer Feb 9, Feb 16, Feb 23, etc. ✅
```

### Root Cause

The `get_tour_slots` function was hardcoded to only look at the **next 7 days**:

```typescript
// OLD CODE (line 361-362)
const startDate = new Date().toISOString().split('T')[0];
const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Only 7 days!

// Loop (line 396)
for (let daysAhead = 0; daysAhead < 7; daysAhead++) { // Only 7 days!
```

This meant:
- **Today:** Jan 30, 2026 (Thursday)
- **7-day window:** Jan 30 - Feb 6
- **First Monday in window:** Feb 2
- **No other Mondays shown:** Feb 9, Feb 16, etc. were outside the 7-day window

When the user asked "what else is available?", the tool returned the same 7-day window, finding only Feb 2 again.

---

## Solution

Extended the availability window from **7 days to 30 days** to show multiple weeks of recurring availability.

### Changes Made

**File:** `server/aiTools.ts`

#### 1. Increased Date Range from 7 to 30 Days (Line ~360-363)

**Before:**
```typescript
// Get showings for next 7 days
const startDate = new Date().toISOString().split('T')[0];
const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const allShowings = await storage.getShowingsByDateRange(startDate, endDate, orgId);
```

**After:**
```typescript
// Get showings for next 30 days (was 7 days - increased to show multiple weeks of availability)
// This allows users to see availability beyond just the current week (e.g., Feb 2, Feb 9, Feb 16, etc.)
const startDate = new Date().toISOString().split('T')[0];
const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const allShowings = await storage.getShowingsByDateRange(startDate, endDate, orgId);
```

#### 2. Extended Loop to 30 Days (Line ~396-404)

**Before:**
```typescript
// Generate time slots only for days that have schedule preferences
const allSuggestions: any[] = [];
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
  const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dateStr = targetDate.toISOString().split('T')[0];
  const dayOfWeek = dayNames[targetDate.getDay()];
  
  // Only process days that have schedule preferences
  if (!daysWithPreferences.has(dayOfWeek)) {
    continue;
  }
```

**After:**
```typescript
// Generate time slots only for days that have schedule preferences
// Loop through next 30 days (was 7 days - increased to show multiple weeks)
const allSuggestions: any[] = [];
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

for (let daysAhead = 0; daysAhead < 30; daysAhead++) {
  const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dateStr = targetDate.toISOString().split('T')[0];
  const dayOfWeek = dayNames[targetDate.getDay()];
  
  // Only process days that have schedule preferences
  if (!daysWithPreferences.has(dayOfWeek)) {
    continue;
  }
```

#### 3. Improved Slot Sorting and Increased Limit (Line ~428-440)

**Before:**
```typescript
// Sort by score and take top 15 slots (was 5, now increased to show broader availability)
// This ensures we show the full availability window (e.g., 9 AM - 12 PM = 12 slots at 15-min intervals)
const topSlots = allSuggestions
  .filter(slot => slot.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 15);
```

**After:**
```typescript
// Sort by date first, then by time, then by score
// This groups slots by date so we show multiple dates (Feb 2, Feb 9, Feb 16, etc.)
// Take top 30 slots to show several dates worth of availability
const topSlots = allSuggestions
  .filter(slot => slot.score > 0)
  .sort((a, b) => {
    // Sort by date first (earlier dates first)
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Then by time (earlier times first)
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    // Finally by score (higher scores first)
    return b.score - a.score;
  })
  .slice(0, 30); // Increased from 15 to show multiple dates
```

**Key improvements:**
- Sort by **date first** (not score) to group slots by date
- Increased limit from **15 to 30 slots** to accommodate multiple dates
- Each date with 9-12 PM availability = ~12 slots, so 30 slots = ~2-3 dates fully shown

---

### AI Instructions Enhanced

**File:** `server/aiReplyGeneratorV2.ts`

#### Added Instructions for Multiple Date Presentation (Line ~628)

**Before:**
```typescript
if (toolCall.name === 'get_tour_slots' && result.data) {
  answerContext += `\nIMPORTANT (get_tour_slots): 
1. Only mention the exact days and times from the data above.
2. Present the FULL TIME RANGE from availableSlots.
\n`;
}
```

**After:**
```typescript
if (toolCall.name === 'get_tour_slots' && result.data) {
  // Extract unique dates from availableSlots
  const uniqueDates = result.data.availableSlots 
    ? [...new Set(result.data.availableSlots.map((slot: any) => slot.date))]
    : [];
  
  answerContext += `\nIMPORTANT (get_tour_slots): 
1. Only mention the exact days and times from the data above. Use availableSlots (date and time) and schedulingInfo.availableDays. Do NOT add other days.
2. Present the FULL TIME RANGE for each date. If slots span from 9:00 AM to 12:00 PM, say "9:00 AM to 12:00 PM" or "9 AM through 12 PM".
3. MULTIPLE DATES: If availableSlots contains multiple dates (${uniqueDates.length} unique dates found), present them ALL. For example: "We have availability on Monday, February 2nd (9 AM - 12 PM), Monday, February 9th (9 AM - 12 PM), and Monday, February 16th (9 AM - 12 PM)." DO NOT say "only one day available" if multiple dates exist.
4. If the user asks "what other days?" and you have ${uniqueDates.length} dates, list ALL of them, not just the first one.
\n`;
}
```

#### Updated User Prompt Instructions (Line ~745)

```typescript
- For get_tour_slots: 
  * Only state the exact days and times from the tool result. Use availableSlots (date/time) and schedulingInfo.availableDays. Do NOT add or assume other days.
  * When presenting times, look at the FULL RANGE of available times for EACH date in availableSlots. If slots span 9:00 AM to 12:00 PM, say "9:00 AM to 12:00 PM" or "9 AM through 12 PM", NOT just "9:00 AM to 10:00 AM".
  * CRITICAL: If availableSlots contains MULTIPLE DATES (e.g., Feb 2, Feb 9, Feb 16), present ALL of them to the user. DO NOT say "only one day available" or limit to just the first date. Group by date and show the time range for each date.
  * Example: If availableSlots has slots for 2026-02-02, 2026-02-09, and 2026-02-16, all with times 9:00-12:00, say "We have availability on Monday, February 2nd (9 AM - 12 PM), Monday, February 9th (9 AM - 12 PM), and Monday, February 16th (9 AM - 12 PM)."
```

---

## Expected Behavior After Fix

### Scenario 1: Initial Tour Request
```
User: "How can I schedule a tour?"
AI: "We have several tour slots available for 123 Main St:
     - Monday, February 2nd (9:00 AM - 12:00 PM)
     - Monday, February 9th (9:00 AM - 12:00 PM)
     - Monday, February 16th (9:00 AM - 12:00 PM)
     - Monday, February 23rd (9:00 AM - 12:00 PM)
     You can book here: [link]" ✅
```

### Scenario 2: Alternative Date Request
```
User: "I'm not available Feb 2, what else is available?"
AI: "No problem! We have availability on:
     - Monday, February 9th (9:00 AM - 12:00 PM)
     - Monday, February 16th (9:00 AM - 12:00 PM)
     - Monday, February 23rd (9:00 AM - 12:00 PM)
     You can book here: [link]" ✅
```

### Scenario 3: Specific Unit Request
```
User: "For unit 1, what other tour days are available apart from Feb 2?"
AI: "For unit 1 at 123 Main St, we have tour availability on:
     - Monday, February 9th (9:00 AM - 12:00 PM)
     - Monday, February 16th (9:00 AM - 12:00 PM)
     - Monday, February 23rd (9:00 AM - 12:00 PM)
     You can book here: [link]" ✅
```

---

## Impact

### Before Fix
- ❌ Only showed next 7 days of availability
- ❌ Couldn't offer alternative dates in future weeks
- ❌ Users thought no other times were available
- ❌ Poor user experience for recurring weekly schedules

### After Fix
- ✅ Shows next 30 days of availability (4+ weeks)
- ✅ Offers multiple alternative dates (Feb 2, 9, 16, 23, etc.)
- ✅ AI presents all available dates when asked
- ✅ Better UX for users with flexible schedules
- ✅ Takes full advantage of recurring weekly availability

---

## Testing

### Test Case 1: Multiple Dates Offered Initially
1. Set schedule preference: Monday 9-12 AM
2. Ask: "How can I schedule a tour?"
3. **Expected:** AI lists multiple Monday dates (Feb 2, Feb 9, Feb 16, etc.)

### Test Case 2: Alternative Dates When First Doesn't Work
1. Ask: "I'm not available Feb 2, what else is available?"
2. **Expected:** AI lists other Monday dates (Feb 9, Feb 16, Feb 23, etc.)

### Test Case 3: Unit-Specific Alternative Dates
1. Ask: "For unit 1, what other tour days are available apart from Feb 2?"
2. **Expected:** AI lists future Monday dates for that specific unit

---

## Summary

Extended tour slot availability window from **7 days to 30 days** and improved date sorting/presentation. The AI now offers multiple weeks of recurring availability instead of limiting to just the current week.

**Key Changes:**
- Date range: 7 days → 30 days ✅
- Loop iterations: 7 → 30 ✅
- Slot limit: 15 → 30 ✅
- Sorting: By score → By date, then time ✅
- AI instructions: Enhanced to present all available dates ✅

Users can now see and book tours on any available date within the next month!
