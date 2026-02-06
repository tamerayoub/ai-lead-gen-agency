# AI Architecture Improvements (ChatGPT Recommendations)

This document outlines the improvements made to the AI Leasing Agent V2 architecture based on expert recommendations.

## 1. Lane-Aware Sources with Typed Citations ✅

### Problem
The original source schema treated all sources the same way, which could lead to memory being cited as authoritative.

### Solution
Implemented typed source citations with lane-specific metadata:

- **Tool Sources**: Include `toolCallId`, `payloadHash` for audit trails
- **RAG Sources**: Include `docId`, `chunkId`, `version`, `effectiveDate`
- **Memory Sources**: Marked as `type: 'memory'` to indicate non-authoritative context
- **System Sources**: For personality settings, style profiles
- **Policy Sources**: Include `version`, `effectiveDate`, `propertyId`

### Implementation
- Updated `aiStructuredOutput.ts` with typed source interfaces
- Added validation to ensure sources match their type
- Memory sources are automatically added when conversation memory is used

### Benefits
- Prevents memory from being cited as authoritative
- Enables better audit trails with tool call IDs and payload hashes
- Supports policy versioning and document tracking

## 2. JSON Repair as Safety Net (Not Normal Path) ✅

### Problem
JSON repair was being used frequently, indicating the API wasn't enforcing structured output properly.

### Solution
- Added `jsonRepaired` flag to structured response
- Automatically degrades confidence from 'high' to 'medium' if JSON repair was used
- Added explicit logging when JSON repair occurs (treated as warning, not normal)
- Enforced strict JSON schema in OpenAI API call

### Implementation
- `aiReplyGeneratorV2.ts`: Tracks `jsonRepaired` flag and degrades confidence
- `aiJsonRepair.ts`: Enhanced repair prompt to prevent placeholder text
- Logging: All repair attempts logged with unique request ID

### Benefits
- JSON repair is now rare (safety net only)
- Confidence levels accurately reflect response quality
- Better debugging with request IDs

## 3. Tool Planning and Sanity Checks ✅

### Problem
Tools were being called without planning, and results weren't validated for common failure modes.

### Solution
Implemented two new components:

#### Tool Planning (`aiToolPlanning.ts`)
- `planToolCalls()`: Decides which tools and parameters before execution
- Avoids calling multiple tools "just in case"
- Returns tool plans with `required` flag and reasoning

#### Tool Result Sanity Checks
- `sanityCheckToolResult()`: Validates tool results for common issues
- Examples:
  - If `get_availability` returns 0 units but property exists → ask follow-up
  - If `quote_price` missing fees/deposit → answer with what we have, mark `needsHuman=true`
  - If `get_tour_slots` returns no slots → valid data, not an error

### Implementation
- `aiToolPlanning.ts`: New module with planning and sanity check functions
- `aiReplyGeneratorV2.ts`: Integrates planning before tool execution, sanity checks after

### Benefits
- Reduces unnecessary tool calls (saves tokens and latency)
- Catches common failure modes before they reach the AI
- Provides better follow-up questions when data is incomplete

## 4. State Machine for Memory Writes ✅

### Problem
Memory state was flexible (`state_json`), which could drift and become inconsistent.

### Solution
Implemented a state machine with:

- **Flow Types**: `availability`, `scheduling`, `qualifications`, `pricing`, `application_status`, `portfolio_units`, `faq_policy`
- **Question Types**: `property_select`, `unit_select`, `date_time_select`, `move_in_date`, `income`, `pets`, `other`
- **Required Fields per Flow**: Defined in `FLOW_REQUIRED_FIELDS`
- **State Transition Validation**: `validateStateTransition()` ensures valid transitions

### Implementation
- `aiConversationMemory.ts`: Added `FlowType`, `QuestionType`, `FLOW_REQUIRED_FIELDS`
- `updateMemoryFromResponse()`: Validates state transitions before saving
- `determineQuestionType()`: Maps questions to question types
- `toolNameToFlowType()`: Maps tool names to flow types

### Benefits
- Prevents state drift and invalid transitions
- Makes flow continuation more reliable
- Easier debugging with explicit flow types

## 5. Unit Detection After Routing ✅

### Problem
Property-level detection was good, but unit identification was left to the LLM guessing.

### Solution
Implemented deterministic unit detection:

- `detectUnitFromMessage()`: Matches user text to unit numbers, bedrooms, bathrooms
- Runs after routing if intent requires `unitId` but it's not set
- Uses `list_portfolio_units()` to get available units first
- Matches patterns like "Unit 12", "2 bed", "studio", "1.5 bath"

### Implementation
- `aiToolPlanning.ts`: `detectUnitFromMessage()` function
- `aiReplyGeneratorV2.ts`: Calls unit detection for pricing intent when `unitId` missing

### Benefits
- More reliable unit identification
- Reduces LLM guessing
- Better user experience with accurate unit matching

## 6. Availability Status vs Listed Status ✅

### Problem
"Listed regardless of occupancy status" was risky wording - could imply immediate move-in.

### Solution
Updated `get_availability` to return:

- `isListed`: Boolean (marketed)
- `availabilityStatus`: `'available_now'` | `'future'` | `'unknown'`
- `nextAvailableDate`: Date string (if known)

### Implementation
- `aiTools.ts`: Updated `getAvailability()` to calculate availability status
- Uses `leaseEndDate` or estimates from `leaseStartDate`
- Returns both `isListed` and `availabilityStatus` for each unit

### Benefits
- Clear distinction between "listed" and "available now"
- Prevents misleading responses about immediate availability
- Better user communication about future availability

## 7. Rate Limiting and Caching (Documentation) 📝

### Recommendation
Add rate limiting and caching boundaries for tools like `get_tour_slots` and `get_availability`.

### Status
**Documented for future implementation**

### Proposed Implementation
- Cache tool responses briefly (30-120s) keyed by `(orgId, propertyId, unitId, params)`
- Add per-lead and per-org rate limits to prevent loops
- Use Redis or in-memory cache for hot paths

### Benefits
- Reduces database load
- Improves response times
- Prevents infinite loops

## 8. Policy Versioning (Documentation) 📝

### Recommendation
Add policy versioning even before vector DB implementation.

### Status
**Documented for future implementation**

### Proposed Implementation
- Store policy entries with `effective_date`, `state`, `property_id`, `version`
- Return citations that include version/effective date
- Support policy history and rollback

### Benefits
- Defensible answers with version tracking
- Support for policy changes over time
- Better audit trails

## Summary

### ✅ Implemented
1. Lane-aware sources with typed citations
2. JSON repair as safety net (not normal path)
3. Tool planning and sanity checks
4. State machine for memory writes
5. Unit detection after routing
6. Availability status vs listed status

### 📝 Documented for Future
7. Rate limiting and caching
8. Policy versioning

## Files Modified

- `server/aiStructuredOutput.ts`: Lane-aware source types
- `server/aiReplyGeneratorV2.ts`: Tool planning, sanity checks, JSON repair tracking
- `server/aiConversationMemory.ts`: State machine validation
- `server/aiToolPlanning.ts`: New module for planning and sanity checks
- `server/aiTools.ts`: Updated `getAvailability()` with availability status
- `server/aiJsonRepair.ts`: Enhanced repair prompt

## Testing Recommendations

1. **Tool Planning**: Verify tools aren't called unnecessarily
2. **Sanity Checks**: Test with edge cases (0 units, missing data)
3. **State Machine**: Verify invalid transitions are rejected
4. **Unit Detection**: Test with various unit mention formats
5. **Availability Status**: Verify correct status is returned for occupied/listed units

