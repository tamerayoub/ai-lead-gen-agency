import OpenAI from "openai";
import { loadTrainedArtifacts, type IntentPlaybook } from "./aiAutoTrain";
import { appearsToAnswerQuestion } from "./aiConversationMemory";

/**
 * Router/Classifier for AI Leasing Agent
 * Classifies user messages to determine which knowledge lane to use:
 * - Lane A (RAG): FAQ/policy questions → use vector retrieval
 * - Lane B (Tools): Availability/pricing/scheduling → use function calling
 * - Unclear: Ask targeted follow-up question
 */

export interface MessageIntent {
  intent: 'faq_policy' | 'qualifications' | 'availability' | 'pricing' | 'scheduling' | 'tour_booking' | 'application_status' | 'portfolio_units' | 'contact_info' | 'neighborhood' | 'unclear';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  followUpQuestion?: string;
  requiresAuth?: boolean;
  shouldContinueFlow?: boolean; // If true, continue current flow instead of re-routing
}

/**
 * Check if message matches intent using playbook examples
 */
function checkPlaybookMatch(
  message: string,
  intentPlaybook: IntentPlaybook | null
): { matchedIntent?: string; boost: number } {
  if (!intentPlaybook || intentPlaybook.intents.length === 0) {
    return { boost: 0 };
  }

  const lowerMessage = message.toLowerCase();
  let bestMatch: { intent: string; score: number } | null = null;

  for (const intent of intentPlaybook.intents) {
    let score = 0;
    for (const example of intent.exampleUtterances) {
      const lowerExample = example.toLowerCase();
      // Simple keyword matching
      const exampleWords = lowerExample.split(/\s+/).filter(w => w.length > 3);
      const matchedWords = exampleWords.filter(word => lowerMessage.includes(word)).length;
      score += matchedWords / exampleWords.length;
    }
    score = score / intent.exampleUtterances.length; // Average across examples

    if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { intent: intent.name, score };
    }
  }

  if (bestMatch && bestMatch.score > 0.3) {
    return {
      matchedIntent: bestMatch.intent,
      boost: Math.min(bestMatch.score * 0.3, 0.3) // Boost confidence by up to 30%
    };
  }

  return { boost: 0 };
}

export interface MemoryContext {
  summary?: string;
  state?: {
    currentFlow?: string | null;
    lastAiQuestion?: string | null;
    propertyId?: string | null;
    unitId?: string | null;
    missingFields?: string[];
    lastIntent?: string | null;
    schedulingMode?: 'link' | 'in_chat';
    booking?: {
      propertyId?: string;
      unitId?: string;
      slotId?: string;
      missingFields?: string[];
      pendingConfirmation?: boolean;
      lastOfferedSlots?: { slotIds: string[]; shownAt: string };
    };
  };
  recentTurns?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function classifyMessageIntent(
  openai: OpenAI,
  message: string,
  leadContext?: {
    hasProperty?: boolean;
    hasApplication?: boolean;
    source?: string;
    orgId?: string;
    propertyId?: string;
  },
  memoryContext?: MemoryContext
): Promise<MessageIntent> {
  // Load intent playbook if available
  let intentPlaybook: IntentPlaybook | null = null;
  if (leadContext?.orgId) {
    const artifacts = await loadTrainedArtifacts(leadContext.orgId, leadContext.propertyId || undefined);
    if (artifacts.enabled && artifacts.intentPlaybook) {
      intentPlaybook = artifacts.intentPlaybook;
    }
  }

  // Check playbook for quick match
  const playbookMatch = checkPlaybookMatch(message, intentPlaybook);
  // Build playbook context if available
  let playbookContext = '';
  if (intentPlaybook && intentPlaybook.intents.length > 0) {
    playbookContext = `\n\nTRAINED INTENT PATTERNS (use as reference, but still classify based on the message):
${intentPlaybook.intents.map(intent => 
  `- ${intent.name}: Common examples include "${intent.exampleUtterances.slice(0, 3).join('", "')}"`
).join('\n')}`;
    
    if (playbookMatch.matchedIntent) {
      playbookContext += `\n\nNOTE: This message shows similarity to "${playbookMatch.matchedIntent}" intent patterns.`;
    }
  }

  // Build memory context string
  let memoryContextStr = '';
  if (memoryContext) {
    if (memoryContext.state?.propertyId) {
      memoryContextStr += `\n- CONVERSATION MEMORY: User is discussing property ID ${memoryContext.state.propertyId}`;
    }
    if (memoryContext.state?.currentFlow) {
      memoryContextStr += `\n- CURRENT FLOW: ${memoryContext.state.currentFlow}`;
    }
    if (memoryContext.state?.lastAiQuestion) {
      memoryContextStr += `\n- LAST AI QUESTION: "${memoryContext.state.lastAiQuestion}"`;
    }
  }

  const classificationPrompt = `Analyze this leasing inquiry message and classify its intent.

Message: "${message}"

Lead Context:
${leadContext?.hasProperty ? '- Has a property linked' : '- No property linked'}
${leadContext?.hasApplication ? '- Has an application' : '- No application'}
${leadContext?.source ? `- Source: ${leadContext.source}` : ''}${memoryContextStr}${playbookContext}

Classify into one of these intents:
1. "qualifications" - Questions about rental qualifications, requirements, screening criteria, income requirements, credit score, eviction history, rental history, what's needed to rent, "what are your qualifications?", "what do I need to qualify?", "what are the requirements?"
2. "faq_policy" - Questions about general policies, rules, pet policy, fees, amenities, building rules, move-in process, fair housing, office hours (NOT qualification-specific)
3. "availability" - Questions about CURRENT unit availability, "is X available?", "what's available right now?", "do you have any available units?" (NOT asking about portfolio in general)
4. "portfolio_units" - Questions about what properties/units are in the portfolio overall, "what units are in your portfolio?", "what do you manage?", "what properties do you have?", "show me your listings"
5. "pricing" - Questions about rent, pricing, deposits, fees, specials, move-in costs
6. "scheduling" - Questions about tours, showings, appointments, "can I see it?", "when can I tour?"
7. "tour_booking" - User wants to BOOK a tour in chat (not just get a link): "help me book a tour", "book a tour with X", "schedule a tour", "book now", "schedule it", "yes book me", "set it up", "can you book it for me", "book it for me"
7. "application_status" - Questions about application status, screening progress, approval status
8. "contact_info" - Questions about who manages the property, company name, who will show the property, leasing agent name, "who is the company?", "who will show me the property?", "who is the leasing agent?"
9. "neighborhood" - Questions about surrounding area, nearby places, what's around, "surrounding area", "what's around", "nearby stores", "neighborhood", "near", "walkable", "transit", "parks", "restaurants", "coffee", "grocery", "pharmacy", "gym"
10. "unclear" - Ambiguous or unclear intent that needs clarification

IMPORTANT RULES:
- If the user is asking "what units are in your portfolio" or "what do you manage", use "portfolio_units" NOT "availability". "availability" is only for asking what's currently available.
- If CONVERSATION MEMORY shows a property ID and the user asks a follow-up question about times/dates/scheduling (like "that day doesn't work, do you have other times?"), classify as "scheduling" and DO NOT ask which property. The property is already known from memory.
- If CURRENT FLOW shows "scheduling" or "tour_scheduling" or "tour_booking" and the user's message is a follow-up about scheduling, keep intent as "scheduling" or "tour_booking" as appropriate.
- If CURRENT FLOW shows "tour_booking", ALWAYS continue that flow - do NOT re-route to a different intent.
- If user says "help me book a tour", "book a tour with [address]", "schedule a tour for [property]" - ALWAYS use "tour_booking" (or "scheduling") even if CURRENT FLOW is "neighborhood". Do NOT continue neighborhood flow for tour booking requests.
- "What about [property]?" / follow-up questions about a property - Use qualifications or neighborhood based on prior context, NOT tour_booking, unless the user explicitly says "book" or "tour" or "schedule".
- Questions about parks, nearby, area, amenities - ALWAYS use "neighborhood", never tour_booking. Answer the question, do not offer to book.
- NEVER ignore or override the lead's explicit question. If they ask about parks, qualifications, pricing, etc., answer that question — do not redirect to booking.

Respond with JSON:
{
  "intent": "qualifications" | "faq_policy" | "availability" | "portfolio_units" | "pricing" | "scheduling" | "tour_booking" | "application_status" | "contact_info" | "neighborhood" | "unclear",
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation",
  "followUpQuestion": "optional targeted question if unclear",
  "requiresAuth": true/false (only true for application_status)
}

Examples:
- "What are your qualifications?" → {"intent": "qualifications", "confidence": "high", "reasoning": "Direct qualification question"}
- "What do I need to qualify?" → {"intent": "qualifications", "confidence": "high", "reasoning": "Asking about qualification requirements"}
- "What are the requirements for 123 Main St?" → {"intent": "qualifications", "confidence": "high", "reasoning": "Property-specific qualification question"}
- "What are your pet policies?" → {"intent": "faq_policy", "confidence": "high", "reasoning": "General policy question (not qualification-specific)"}
- "Is 123 Main St available?" → {"intent": "availability", "confidence": "high", "reasoning": "Asking about specific property availability"}
- "How much is rent?" → {"intent": "pricing", "confidence": "high", "reasoning": "Pricing question"}
- "Can I schedule a tour?" → {"intent": "scheduling", "confidence": "high", "reasoning": "Tour request"}
- "What's my application status?" → {"intent": "application_status", "confidence": "high", "reasoning": "Application status inquiry", "requiresAuth": true}
- "Who is the company and leasing agent that will show me the property?" → {"intent": "contact_info", "confidence": "high", "reasoning": "Asking about company name and who will conduct the tour"}
- "Who will show me the property?" → {"intent": "contact_info", "confidence": "high", "reasoning": "Asking about assigned leasing agent"}
- "What is the property management company?" → {"intent": "contact_info", "confidence": "high", "reasoning": "Asking about organization/company name"}
- "What property did I inquire about?" (WITH MEMORY: propertyId set) → {"intent": "contact_info", "confidence": "high", "reasoning": "Asking which property we've been discussing - use memory/context"}
- "What's around here?" / "Nearby stores?" / "What's the neighborhood like?" / "Is it walkable?" / "Transit nearby?" / "Parks or restaurants?" → {"intent": "neighborhood", "confidence": "high", "reasoning": "Asking about nearby places or area amenities"}
- "That day doesn't work, do you have other times?" (WITH MEMORY: propertyId=123, currentFlow=scheduling) → {"intent": "scheduling", "confidence": "high", "reasoning": "Follow-up scheduling question, property already known from memory"}
- "What about other days?" (WITH MEMORY: propertyId=123, currentFlow=scheduling) → {"intent": "scheduling", "confidence": "high", "reasoning": "Follow-up scheduling question, property already known from memory"}
- "Help me book a tour with 123 Main Street" (even WITH MEMORY: currentFlow=neighborhood) → {"intent": "tour_booking", "confidence": "high", "reasoning": "Explicit tour booking request - user wants to book a tour"}
- "What about [property]?" (WITH MEMORY: just discussed qualifications or neighborhood) → {"intent": "qualifications" or "neighborhood", "confidence": "high", "reasoning": "Follow-up about a property - same topic as prior message"} Do NOT use tour_booking unless user explicitly says "book" or "tour"
- "I want to know more about the parks in the area" / "Tell me about nearby restaurants" → {"intent": "neighborhood", "confidence": "high", "reasoning": "Explicit question about parks/area/amenities"}
- "Hi" → {"intent": "unclear", "confidence": "low", "reasoning": "Generic greeting", "followUpQuestion": "What can I help you with today? Are you looking for available units, pricing information, or have questions about our qualifications or policies?"}
- "What's 5 times 5?" / "What's 2+2?" → {"intent": "unclear", "confidence": "low", "reasoning": "Off-topic (not about listings)", "followUpQuestion": "I'm bringing the conversation back to the listing — did you have any questions about our properties, availability, pricing, or qualifications?"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: classificationPrompt
      }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Apply playbook boost if match found
    let confidence = result.confidence || 'low';
    if (playbookMatch.matchedIntent && result.intent === playbookMatch.matchedIntent) {
      // Boost confidence if playbook matches LLM classification
      if (confidence === 'low') confidence = 'medium';
      else if (confidence === 'medium') confidence = 'high';
    }

    // Use playbook follow-up if available and intent is unclear
    let followUpQuestion = result.followUpQuestion;
    if (result.intent === 'unclear' && intentPlaybook) {
      const unclearIntent = intentPlaybook.intents.find(i => i.name === 'unclear');
      if (unclearIntent?.defaultFollowUpQuestion) {
        followUpQuestion = unclearIntent.defaultFollowUpQuestion;
      } else {
        // Use first intent's follow-up as fallback
        const firstIntent = intentPlaybook.intents[0];
        if (firstIntent?.defaultFollowUpQuestion) {
          followUpQuestion = firstIntent.defaultFollowUpQuestion;
        }
      }
    }

    // Determine if we should continue the current flow
    // tour_booking flow: ALWAYS continue - never re-route
    const isTourBookingFlow = memoryContext?.state?.currentFlow === 'tour_booking';
    const appearsToAnswer = memoryContext?.state?.lastAiQuestion 
      ? appearsToAnswerQuestion(message, memoryContext.state.lastAiQuestion)
      : false;

    // CRITICAL: Do NOT continue neighborhood/other flows when user explicitly requests tour booking.
    // "Help me book a tour", "schedule a tour", "book a showing" etc. should route to tour_booking,
    // even if the message contains a property name that would match appearsToAnswerQuestion.
    const explicitTourBookingPhrases = /\b(help\s+me\s+book|book\s+a\s+tour|schedule\s+a\s+tour|book\s+a\s+showing|schedule\s+a\s+showing|i\s+want\s+to\s+book|i'd\s+like\s+to\s+book|can\s+you\s+book|please\s+book|book\s+me\s+(a\s+)?tour)\b/i;
    const isExplicitTourBookingRequest = explicitTourBookingPhrases.test(message);
    const currentFlowIsSchedulingRelated = memoryContext?.state?.currentFlow === 'tour_booking' || memoryContext?.state?.currentFlow === 'scheduling';
    const shouldOverrideFlowContinuation = isExplicitTourBookingRequest && !currentFlowIsSchedulingRelated && (result.intent === 'tour_booking' || result.intent === 'scheduling');

    const shouldContinueFlow = (isTourBookingFlow || (appearsToAnswer && !shouldOverrideFlowContinuation));

    // If should continue flow, use the current flow's intent
    let finalIntent = result.intent || 'unclear';
    if (shouldContinueFlow && memoryContext?.state?.currentFlow) {
      // Map flow to intent
      const flowToIntent: Record<string, string> = {
        'scheduling': 'scheduling',
        'tour_scheduling': 'scheduling',
        'tour_booking': 'tour_booking',
        'pricing': 'pricing',
        'availability': 'availability',
        'qualifications': 'qualifications',
        'portfolio_units': 'portfolio_units',
        'portfolio_browse': 'portfolio_units',
        'neighborhood': 'neighborhood'
      };
      const mappedIntent = flowToIntent[memoryContext.state.currentFlow];
      if (mappedIntent) {
        finalIntent = mappedIntent;
        console.log('[AI Router] Continuing flow, using intent:', finalIntent, 'from flow:', memoryContext.state.currentFlow);
      }
    }
    
    // If we have a propertyId in memory and the intent requires it, ensure it's used
    if (memoryContext?.state?.propertyId && !leadContext?.propertyId) {
      // Update leadContext to include propertyId from memory
      leadContext = {
        ...leadContext,
        propertyId: memoryContext.state.propertyId,
        hasProperty: true
      };
      console.log('[AI Router] Using propertyId from memory for context:', memoryContext.state.propertyId);
    }

    return {
      intent: finalIntent as MessageIntent['intent'],
      confidence: confidence as 'high' | 'medium' | 'low',
      reasoning: result.reasoning || '',
      followUpQuestion,
      requiresAuth: result.requiresAuth || false,
      shouldContinueFlow
    };
  } catch (error) {
    console.error('[AI Router] Classification error:', error);
    // Fallback to unclear if classification fails
    return {
      intent: 'unclear',
      confidence: 'low',
      reasoning: 'Classification failed, defaulting to unclear',
      followUpQuestion: 'What can I help you with today?'
    };
  }
}

