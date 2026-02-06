# AI Leasing Agent Architecture V2

## Overview

The AI Leasing Agent uses a **RAG + Tools + Structured Outputs** architecture for maximum accuracy and grounded responses. The system is designed with a 2-lane knowledge setup: slow-changing RAG for policies/FAQs and fast-changing tools for real-time data.

## Architecture Components

### 1. Conversation Memory Layer (`aiConversationMemory.ts`)
- **Purpose**: Maintains rolling conversation summaries and state per lead for context-aware responses
- **Storage**: `lead_ai_memory` table (summary_text, state_json, updated_at)
- **Memory Read**: Happens BEFORE routing to provide context to router
- **Memory Write**: Happens AFTER response generation to update state
- **What Memory Stores**:
  - `summary_text`: Rolling summary of conversation (≤800 chars)
  - `state_json`: Current flow, last AI question, propertyId/unitId, missing fields, last intent, lastToolResults
- **What Memory NEVER Stores**:
  - Prices, availability, dates, unit numbers (these come from tools)
  - Policy details (these come from RAG/DB)
- **Flow Continuation**: If user message appears to answer last AI question, router continues current flow instead of re-routing
- **Heuristics**: 
  - If `lastAiQuestion` asks "Which property...?" and user message matches a known property/address → treat as answer
  - If `lastAiQuestion` asks "What date/time...?" and user message contains a date/time → treat as answer

### 2. Router/Classifier (`aiRouter.ts`)
- **Purpose**: Classifies incoming messages to determine which knowledge lane to use
- **Enhanced with Memory**: Receives conversation context (summary, state, recent turns) to make better routing decisions
- **Flow Continuation**: Uses `shouldContinueFlow` heuristic to continue existing flows when user answers previous questions
- **Intents**:
  - `faq_policy` → Use RAG (vector retrieval)
  - `qualifications` → Use `get_qualifications` tool
  - `availability` → Use `get_availability` tool (current availability)
  - `portfolio_units` → Use `list_portfolio_units` tool (all listed units)
  - `pricing` → Use `quote_price` tool
  - `scheduling` → Use `get_tour_slots` tool
  - `application_status` → Use `get_application_status` tool
  - `neighborhood` → Use `get_nearby_places_openai` tool (OpenAI web search for nearby grocery, coffee, restaurants, parks, transit, etc.)
  - `unclear` → Return follow-up question
- **Intent Playbook Integration**: Uses Auto Train's IntentPlaybook to boost classification confidence

### 3. Tools (`aiTools.ts`)
- **Purpose**: Function calling for real-time, authoritative data (Lane B)
- **Tools**:
  - `get_qualifications(propertyId?)` - Leasing qualification requirements (income multiplier, credit score, rental history, criminal history, employment, occupants, pets, security deposit)
  - `get_availability(propertyId?, unitId?)` - Real-time unit availability (listed units only, regardless of occupancy status)
  - `list_portfolio_units(propertyId?)` - List all properties and units in portfolio
  - `quote_price(unitId, moveInDate?)` - Pricing information (rent, deposit, fees)
  - `get_tour_slots(propertyId, unitId?, preferredTimes?)` - Available tour slots with scheduling info (buffer time, lead time, event duration, available days)
  - `get_application_status(leadId)` - Application status (requires auth)
  - `get_property_location(propertyId)` - Property address for geocoding/nearby search
  - `get_nearby_places_openai(propertyId, radiusMeters?, categories?)` - Nearby places via OpenAI Responses API with web_search (grocery, coffee, restaurants, parks, transit, etc.). Results cached in `property_area_cache` (7-day TTL).

**Key Principle**: Never RAG this data - always fetch from database/calendar at runtime.

**Tool Optimizations**:
- `get_tour_slots`: Only processes days that have schedule preferences (reduces compute/memory)
- `get_availability`: Returns units as available if listed, regardless of occupancy status
- Returns `schedulingInfo` with buffer time, lead time, event duration, and available days

### 4. Property Detection (`aiReplyGeneratorV2.ts`)
- **Purpose**: Automatically detects property mentions in lead messages
- **Address Normalization**: Handles variations like "Street" vs "St", "Avenue" vs "Ave", etc.
- **Pattern Matching**: Uses multiple regex patterns to extract potential addresses from messages
- **Integration**: Detected property ID is passed to tools (e.g., `get_qualifications`, `get_availability`)
- **Logging**: Extensive logging for debugging property detection and matching

### 5. JSON Repair Pipeline (`aiJsonRepair.ts`)
- **Purpose**: Handles malformed JSON output from OpenAI API
- **Process**:
  1. Attempt direct JSON.parse()
  2. If fails, extract JSON from markdown/prose
  3. If still fails, use LLM to repair JSON (with explicit instructions to avoid placeholder text)
  4. If repair fails, return safe fallback response
- **Logging**: All repair attempts logged with unique request ID
- **Anti-Placeholder**: Repair prompt explicitly instructs model to write real responses, not placeholders

### 6. Structured Outputs (`aiStructuredOutput.ts`)
- **Purpose**: Ensures consistent, verifiable responses
- **Source Types**: tool, rag, memory, system, database, policy. Tool sources can include web citation fields: provider, url, title, retrievedAt for neighborhood/web-backed tools.
- **Schema**:
  ```typescript
  {
    answer: string;              // Natural language response (NO placeholder text)
    sources: Source[];           // Citations for every factual claim (tool sources may include url, title for web citations)
    confidence: 'high'|'medium'|'low';
    needsHuman: boolean;         // Escalation flag
    followUpQuestion?: string;
    toolResults?: ToolResult[];
  }
  ```
- **Validation**: Strict schema validation with `additionalProperties: false`
- **Anti-Placeholder Instructions**: System and user prompts explicitly forbid placeholder text like "This is a sample answer"

### 7. Response Generation (`aiReplyGeneratorV2.ts`)
- **Purpose**: Orchestrates the entire V2 flow
- **Flow**:
  1. Memory Read (load conversation context)
  2. Property Detection (if not already set)
  3. Router/Classifier (with memory context)
  4. Tool Execution or RAG Retrieval
  5. Structured Output Generation
  6. Memory Write (update conversation state)
- **Style Integration**: Uses StyleMixer to combine PersonalitySettings + StyleProfile
- **Length Constraints**: Enforces max sentences based on `responseLength` setting
- **Post-Processing**: Removes placeholder text, enforces conversational tone

### 8. RAG (Vector Store) - TODO
- **Purpose**: Slow-changing knowledge retrieval (Lane A)
- **Content**: Policies, FAQs, rules, amenities, building info
- **Status**: Currently using database fallback, vector store to be implemented

## Flow Diagram

```
User Message
    ↓
[CONVERSATION MEMORY READ]
    ↓
[PROPERTY DETECTION] (if propertyId not set)
    ↓
Router/Classifier (with memory context)
    ↓
┌─────────────────┬─────────────────┐
│   Lane A (RAG)  │  Lane B (Tools) │
│                 │                 │
│ FAQ/Policy      │ Availability    │
│ Questions       │ Pricing         │
│                 │ Scheduling      │
│                 │ Portfolio       │
│                 │ Qualifications  │
│                 │ App Status      │
│                 │ Neighborhood    │
└─────────────────┴─────────────────┘
    ↓
Structured Output Generator
    ↓
[JSON Repair] (if needed)
    ↓
[CONVERSATION MEMORY WRITE]
    ↓
Response with Sources + Confidence
```

## Guardrails

1. **Grounded Answers Only**: Never make up prices, availability, or policies
2. **Source Requirements**: Every factual claim must have a source
3. **Escalation Rules**: Auto-escalate legal questions, complaints, denials
4. **Tool Usage**: Must call tools for availability/pricing/scheduling questions
5. **Uncertainty Handling**: If tools fail or return no data, say so clearly
6. **No Placeholder Text**: Explicitly forbidden in prompts and repair process
7. **Conversational Tone**: Responses must be natural and helpful, not robotic
8. **Neighborhood Guardrails**: Do NOT claim crime/safety. Do NOT infer demographics. "Is it safe?" → needsHuman=true

## Usage

### Basic Usage
```typescript
import { generateAIReplyV2 } from './aiReplyGeneratorV2';

const response = await generateAIReplyV2(openai, {
  orgId: 'org-123',
  leadMessage: 'Is 123 Main St available?',
  leadId: 'lead-456',
  lead: {
    id: 'lead-456',
    name: 'John Doe',
    propertyId: 'prop-789'
  }
});

// Response includes:
// - answer: Natural language response (no placeholders)
// - sources: Array of sources used
// - confidence: 'high' | 'medium' | 'low'
// - needsHuman: boolean
```

### Feature Flag
To switch between V1 (old) and V2 (new) architecture:
```typescript
const useV2 = process.env.AI_REPLY_V2 === 'true' || 
              await storage.getAISettings('ai_architecture', orgId)
                .find(s => s.key === 'use_v2')?.value === 'true';
```

## Auto Train AI Feature

### Overview
The Auto Train feature learns style and intent patterns from historical conversations to improve:
1. **Intent Routing**: Better classification using learned patterns
2. **Tone/Style Consistency**: Matches your organization's communication style

### What Auto Train Learns ✅
- **StyleProfile**: Greeting/closing patterns, common phrases, formatting preferences, emoji usage, personalization tokens, "doNotUse" phrases
- **IntentPlaybook**: Common lead intents, example utterances, required fields, recommended tools, follow-up questions

### What Auto Train NEVER Learns ❌
- **Factual Data**: Prices, availability, dates, unit numbers, deposits, specials
- **Policy Details**: These come from DB/vector store, not history
- **Property-Specific Facts**: Always fetched via tools at runtime

### Architecture

```
Historical Conversations
    ↓
Auto Train Pipeline (aiAutoTrain.ts)
    ↓
┌─────────────────┬─────────────────┐
│  StyleProfile   │  IntentPlaybook  │
│  (tone/style)   │  (routing)       │
└─────────────────┴─────────────────┘
    ↓                    ↓
StyleMixer          aiRouter.ts
(personality +      (boosted
 style profile)      classification)
    ↓
aiReplyGeneratorV2.ts
(apply style constraints)
```

### Usage

#### Training
```typescript
POST /api/ai-training/auto-train
{
  "propertyId": "optional",
  "windowDays": 90,
  "dryRun": false
}
```

#### Storage
Artifacts are saved in `ai_settings` table:
- `category='ai_auto_train'`
- `key='organization_style_profile'` or `key='property_{id}_style_profile'`
- `key='organization_intent_playbook'` or `key='property_{id}_intent_playbook'`

#### Application
- **Router**: Uses IntentPlaybook to boost classification confidence
- **Generator**: Uses StyleProfile + PersonalitySettings via StyleMixer
- **Post-processing**: Enforces length constraints, personalization

### Guardrails

1. **Tool Calls Mandatory**: For pricing/availability/scheduling questions, tools MUST be called
2. **No Factual Learning**: StyleProfile and IntentPlaybook never contain prices/dates/unit numbers
3. **Grounding Required**: If tool fails or returns no data, set `needsHuman=true`
4. **Length Enforcement**: Post-processor enforces max sentences based on responseLength setting

## Facebook Marketplace Integration

### Automatic Listing Import
- **Trigger**: When Facebook messages are polled and new `facebookListingId` values are detected
- **Process**:
  1. Creates "Facebook Imported Listings" property (if doesn't exist)
  2. Creates placeholder unit with format `FB-{listingId}`
  3. Creates listing linked to placeholder unit
  4. Stores `facebookListingId` in listing record
- **Location**: `server/routes.ts` - Facebook message processing endpoint

### Listing Linking
- **Purpose**: Link Facebook-imported listings to real properties/units
- **UI**: "Link" button appears for unlinked listings (placeholder units)
- **Backend**: `PATCH /api/listings/:id/link` endpoint
- **Result**: Listing absorbs property name, rent price, and other details from linked unit

## Neighborhood / Nearby Places

### Overview
The AI can answer questions about nearby amenities (grocery, coffee, restaurants, parks, transit, etc.) using OpenAI's Responses API with built-in web search. No Google Maps/Places API.

### Flow
1. Lead asks: "What's around?", "Nearby stores?", "Is it walkable?", "Transit nearby?"
2. Router classifies as `neighborhood` intent
3. Tool `get_nearby_places_openai` called with propertyId
4. Cache check: `property_area_cache` (TTL 7 days)
5. On miss: OpenAI Responses API with `tools: [{ type: 'web_search' }]`
6. Structured result: `{ centerAddress, groups: { grocery, coffee, restaurants, ... }, citations }`
7. Response includes disclaimer: "Nearby options are based on public web listings; please verify hours."
8. Memory: `currentFlow='neighborhood'` but places list NOT stored

### Guardrails
- Do NOT claim crime/safety. "Is it safe?" → needsHuman=true, suggest official sources
- Do NOT infer demographics
- `OPENAI_NEIGHBORHOOD_MODEL` env (default gpt-4o)

### Cache
- Table: `property_area_cache`
- Key: (propertyId, radiusMeters, categoriesHash)
- TTL: 7 days

## Recent Improvements

See `AI_ARCHITECTURE_IMPROVEMENTS.md` for detailed documentation of recent enhancements:

1. **Lane-Aware Sources**: Typed citations prevent memory from being cited as authoritative
2. **JSON Repair Safety Net**: JSON repair degrades confidence and is logged as warning
3. **Tool Planning**: Decides which tools to call before execution
4. **Tool Result Sanity Checks**: Validates results for common failure modes
5. **State Machine for Memory**: Validates state transitions to prevent drift
6. **Unit Detection**: Deterministic unit identification after routing
7. **Availability Status**: Clear distinction between "listed" and "available now"

## Next Steps

1. **Vector Store Implementation**
   - Set up OpenAI file search or external vector DB
   - Chunk policies/FAQs by meaning
   - Add metadata (property_id, state, effective_date)
   - Implement hybrid search (keyword + semantic)

2. **Continuous Evals**
   - Create gold dataset of Q&A pairs
   - Set up automated graders
   - Run evals on prompt/tool changes

3. **Enhanced Tools**
   - `create_tour(leadId, slotId)` - Book a tour
   - `create_application_link(leadId)` - Generate application link
   - `handoff_to_human(reason, transcript)` - Escalate to human

4. **Rate Limiting and Caching** (See improvements doc)
   - Cache tool responses (30-120s) for hot paths
   - Add per-lead and per-org rate limits

5. **Policy Versioning** (See improvements doc)
   - Store policies with version/effective_date
   - Return citations with version info

6. **Fine-tuning** (if needed)
   - Only for tone/format consistency
   - Better intent classification
   - Better tool selection
   - NOT for storing policies/pricing

## Benefits

✅ **Accuracy**: Grounded answers from authoritative sources  
✅ **Transparency**: Sources and confidence levels  
✅ **Maintainability**: Clear separation of concerns  
✅ **Scalability**: Easy to add new tools/policies  
✅ **Safety**: Guardrails prevent hallucinations  
✅ **Efficiency**: Router reduces token burn  
✅ **Context-Aware**: Conversation memory enables flow continuation  
✅ **Natural Responses**: Anti-placeholder instructions ensure conversational tone
