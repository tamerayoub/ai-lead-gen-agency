# AI Leasing Agent V2 Implementation Summary

## ✅ Completed Components

### 1. Router/Classifier (`aiRouter.ts`)
- ✅ Message intent classification
- ✅ Routes to appropriate knowledge lane
- ✅ Handles unclear intents with follow-up questions
- ✅ Conversation memory integration (receives context pack)
- ✅ Flow continuation logic (continues existing flows when user answers previous questions)
- ✅ Intent Playbook integration (uses Auto Train artifacts to boost classification)

### 2. Tools (`aiTools.ts`)
- ✅ `get_qualifications(propertyId?)` - Leasing qualification requirements
  - Returns income multiplier, credit score, rental history, criminal history, employment, occupants, pets, security deposit
  - Supports property-level overrides
- ✅ `get_availability(propertyId?, unitId?)` - Real-time unit availability
  - Returns listed units regardless of occupancy status
  - Optimized to only check listed units with booking enabled
- ✅ `list_portfolio_units(propertyId?)` - List all properties and units in portfolio
- ✅ `quote_price(unitId, moveInDate?)` - Pricing information
- ✅ `get_tour_slots(propertyId, unitId?, preferredTimes?)` - Available tour slots
  - Optimized to only process days with schedule preferences
  - Returns scheduling info (buffer time, lead time, event duration, available days)
- ✅ `get_application_status(leadId)` - Application status
- ✅ OpenAI function calling definitions

### 3. Structured Outputs (`aiStructuredOutput.ts`)
- ✅ JSON schema for structured responses
- ✅ Validation and guardrails
- ✅ Source tracking and confidence levels
- ✅ Strict schema validation (`additionalProperties: false`)

### 4. V2 Reply Generator (`aiReplyGeneratorV2.ts`)
- ✅ Router → Tools/RAG → Structured Output flow
- ✅ Personality settings integration
- ✅ Tool execution and result handling
- ✅ Fallback to database for RAG (until vector store implemented)
- ✅ Property detection from messages (with address normalization)
- ✅ Conversation memory integration (read before routing, write after response)
- ✅ Style profile integration via StyleMixer
- ✅ Anti-placeholder instructions (prevents robotic responses)
- ✅ Length constraint enforcement

### 5. Conversation Memory (`aiConversationMemory.ts`)
- ✅ Rolling conversation summaries (≤800 chars)
- ✅ State tracking (currentFlow, lastAiQuestion, propertyId/unitId, missingFields, lastIntent)
- ✅ Flow continuation heuristics
- ✅ Memory read/write integration in V2 flow
- ✅ Database-backed storage (`lead_ai_memory` table)

### 6. JSON Repair Pipeline (`aiJsonRepair.ts`)
- ✅ Handles malformed JSON from OpenAI API
- ✅ Direct parse attempt
- ✅ Markdown/prose extraction
- ✅ LLM-based repair with anti-placeholder instructions
- ✅ Safe fallback response generation
- ✅ Comprehensive logging with request IDs

### 7. Auto Train AI (`aiAutoTrain.ts`)
- ✅ StyleProfile generation (greeting/closing, phrases, formatting, emoji policy)
- ✅ IntentPlaybook generation (common intents, example utterances, follow-ups)
- ✅ Guardrails to prevent learning factual data
- ✅ Organization and property-level training
- ✅ Storage in `ai_settings` table

### 8. Style Mixer (`aiStyleMixer.ts`)
- ✅ Combines PersonalitySettings + StyleProfile
- ✅ Generates generation constraints (maxSentences, contractions, urgency phrases)
- ✅ Applies warmth/personalization rules
- ✅ Enforces informational vs sales CTA

### 9. Facebook Marketplace Integration
- ✅ Automatic listing import when new `facebookListingId` detected
- ✅ Listing linking UI and backend endpoint
- ✅ Placeholder unit creation for unlinked listings

## 🔄 Integration Status

The V2 architecture is **fully integrated and active** in:
- ✅ `/api/leads/:leadId/ai-reply` - Live lead replies
- ✅ `/api/ai-training/practice` - Interactive training sessions

### Feature Flags

1. **Environment Variable**
   ```bash
   AI_REPLY_V2=true
   ```

2. **Database Setting**
   ```sql
   INSERT INTO ai_settings (org_id, category, key, value)
   VALUES ('your-org-id', 'ai_architecture', 'use_v2', 'true');
   ```

## 📋 Recent Enhancements

### Property Detection
- ✅ Automatic property mention detection in lead messages
- ✅ Address normalization (handles "Street" vs "St", etc.)
- ✅ Multiple regex patterns for address extraction
- ✅ Integration with tools (passes `detectedPropertyId` to `get_qualifications`, `get_availability`)

### Response Quality Improvements
- ✅ Anti-placeholder instructions in system and user prompts
- ✅ Explicit instructions to write natural, conversational responses
- ✅ JSON repair process includes anti-placeholder instructions
- ✅ Post-processing to ensure conversational tone

### Tool Optimizations
- ✅ `get_tour_slots`: Only processes days with schedule preferences (reduces compute/memory)
- ✅ `get_availability`: Returns units as available if listed, regardless of occupancy
- ✅ Scheduling info included in tour slots response (buffer time, lead time, event duration)

### Conversation Memory
- ✅ Flow continuation when user answers previous AI questions
- ✅ Heuristics for detecting answers to questions
- ✅ State persistence across conversation turns

### Facebook Integration
- ✅ Automatic listing creation when Facebook listing IDs detected
- ✅ Listing linking feature to connect imported listings to real properties/units
- ✅ UI for linking unlinked listings

## 📋 Next Steps (TODO)

### High Priority
1. **Vector Store Implementation** (Lane A - RAG)
   - Set up OpenAI file search or external vector DB (Pinecone, Weaviate, etc.)
   - Chunk policies/FAQs by meaning (not arbitrary tokens)
   - Add metadata: property_id, state, effective_date, policy_type
   - Implement hybrid search (keyword + semantic)

2. **Enhanced Tools**
   - `create_tour(leadId, slotId)` - Book a tour
   - `create_application_link(leadId)` - Generate application link
   - `handoff_to_human(reason, transcript)` - Escalate to human

### Medium Priority
3. **Continuous Evals**
   - Create gold dataset of Q&A pairs
   - Set up automated graders
   - Run evals on prompt/tool changes
   - Use OpenAI Evals framework

4. **UI Enhancements**
   - Display sources/citations in responses
   - Show confidence levels
   - Auto-escalate when `needsHuman=true`
   - Log low-confidence answers

### Low Priority
5. **Fine-tuning** (if needed)
   - Only for tone/format consistency
   - Better intent classification
   - Better tool selection
   - NOT for storing policies/pricing

## 🎯 Benefits of V2

✅ **Accuracy**: Grounded answers from authoritative sources  
✅ **Transparency**: Sources and confidence levels  
✅ **Maintainability**: Clear separation of concerns  
✅ **Scalability**: Easy to add new tools/policies  
✅ **Safety**: Guardrails prevent hallucinations  
✅ **Efficiency**: Router reduces token burn  
✅ **Context-Aware**: Conversation memory enables flow continuation  
✅ **Natural Responses**: Anti-placeholder instructions ensure conversational tone  
✅ **Property Detection**: Automatic property mention detection improves accuracy  
✅ **Optimized Performance**: Tool optimizations reduce compute and memory usage

## 📚 Architecture Documentation

See `AI_ARCHITECTURE.md` for detailed architecture documentation.

## ✅ Auto Train AI Feature

### Implementation Status
- [x] `aiAutoTrain.ts` - StyleProfile and IntentPlaybook generation
- [x] `aiStyleMixer.ts` - Personality settings + StyleProfile mixing
- [x] Router integration - Uses IntentPlaybook to boost classification
- [x] Generator integration - Applies StyleProfile via StyleMixer
- [x] API endpoint - `POST /api/ai-training/auto-train`
- [x] Guardrails - Ensures no factual data in training artifacts
- [x] Post-processing - Enforces length constraints
- [x] Tests - Unit tests for guardrails

### Usage
```bash
POST /api/ai-training/auto-train
{
  "propertyId": "optional",
  "windowDays": 90,
  "dryRun": false
}
```

### What Auto Train Learns ✅
- Style patterns (greetings, closings, tone, formatting)
- Intent routing patterns (common questions, follow-ups)

### What Auto Train NEVER Learns ❌
- Prices, availability, dates, unit numbers
- Policy details (these come from DB/vector store)
- Property-specific facts

## 🔍 Testing

To test V2:
1. Enable V2 via environment variable or database setting (already enabled by default)
2. Send a test message asking about availability, pricing, or policies
3. Check logs for structured response metadata
4. Verify sources and confidence levels
5. Test property detection by asking about a property by address
6. Test conversation memory by continuing a previous conversation flow

To test Auto Train:
1. Run `POST /api/ai-training/auto-train` with conversation history
2. Verify StyleProfile and IntentPlaybook are generated
3. Check that no factual data (prices/dates) is in artifacts
4. Test router with playbook enabled
5. Test generator with style profile enabled

## ⚠️ Known Limitations

1. **RAG currently uses database fallback** - Vector store not yet implemented
2. **Tool error handling** - Could be more robust
3. **Property detection** - May need enhancement for better unit identification (currently works well for property-level)
4. **Conversation context** - Could be optimized for better context window usage
5. **Auto Train** - Currently org-level only, property-scoped training needs testing
6. **JSON Repair** - May occasionally fail on very malformed responses (fallback handles this)
7. **TypeScript Type Narrowing** - Some intent types may show type errors in IDE but work correctly at runtime

## Recent Improvements

See `AI_ARCHITECTURE_IMPROVEMENTS.md` for detailed documentation of recent enhancements based on expert recommendations:

✅ **Implemented:**
- Lane-aware sources with typed citations
- JSON repair as safety net (not normal path)
- Tool planning and sanity checks
- State machine for memory writes
- Unit detection after routing
- Availability status vs listed status

📝 **Documented for Future:**
- Rate limiting and caching
- Policy versioning

## 🔧 Configuration

### Personality Settings
- Response Length: `short`, `medium`, `long`, `one-paragraph`
- Tone: `professional`, `friendly`, `casual`
- Formality: `formal`, `neutral`, `informal`
- Emoji Usage: `none`, `minimal`, `moderate`, `frequent`

### Auto-Pilot Settings
- Follow-up enabled/disabled
- Follow-up delay (minutes)
- Pre-qualification enabled/disabled
- Daily message limit
- Response delay (seconds)
- Office hours only
- Keywords for human handoff
- AI Leasing Agent name

### Memory Settings
- Summary length: ≤800 characters
- Recent turns: Last 10 conversation turns
- State persistence: Per lead, updated after each response
