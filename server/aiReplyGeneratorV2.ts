import crypto from "crypto";
import OpenAI from "openai";
import { storage } from "./storage";
import { classifyMessageIntent, MessageIntent, type MemoryContext } from "./aiRouter";
import { aiToolDefinitions, executeTool, ToolResult } from "./aiTools";
import { StructuredAIResponse, structuredOutputSchema, validateStructuredResponse, getGuardrailInstructions } from "./aiStructuredOutput";
import { loadTrainedArtifacts } from "./aiAutoTrain";
import { buildStyleInstructions, enforceLengthConstraint, type PersonalitySettings } from "./aiStyleMixer";
import { buildContextPack, updateMemoryFromResponse, loadLeadMemory, type ConversationContextPack } from "./aiConversationMemory";
import { extractContactFromMessage } from "./aiContactExtractor";

/**
 * V2 AI Reply Generator - RAG + Tools + Structured Outputs Architecture
 * 
 * Flow:
 * 1. Router classifies message intent
 * 2. If unclear → return follow-up question
 * 3. If FAQ/policy → use RAG (vector retrieval) - TODO: implement vector store
 * 4. If availability/pricing/scheduling → use tools (function calling)
 * 5. Generate structured response with sources and confidence
 */

interface AIReplyV2Options {
  orgId: string;
  leadMessage: string;
  leadId?: string;
  lead?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    propertyId?: string | null;
    propertyName?: string | null;
    source?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  };
  conversations?: any[];
  isPracticeMode?: boolean;
  personalitySettings?: {
    friendliness?: string;
    formality?: string;
    responseLength?: string;
    urgency?: string;
    warmth?: string;
    communicationStyle?: string;
  };
}

export async function generateAIReplyV2(
  openai: OpenAI,
  options: AIReplyV2Options
): Promise<StructuredAIResponse> {
  const {
    orgId,
    leadMessage,
    leadId,
    lead,
    conversations = [],
    isPracticeMode = false,
    personalitySettings = {}
  } = options;

  // MEMORY READ (pre-router): Load conversation memory
  let memoryContext: MemoryContext | undefined;
  let contextPack: ConversationContextPack | null = null;
  if (leadId && !isPracticeMode) {
    try {
      contextPack = await buildContextPack(leadId, orgId);
      memoryContext = {
        summary: contextPack.summary,
        state: contextPack.state,
        recentTurns: contextPack.recentTurns
      };
      console.log('[AI V2] Loaded conversation memory:', {
        summaryLength: contextPack.summary.length,
        state: contextPack.state,
        recentTurnsCount: contextPack.recentTurns.length
      });
    } catch (error) {
      console.error('[AI V2] Error loading conversation memory:', error);
    }
  } else if (isPracticeMode && conversations && conversations.length > 0) {
    // In practice mode: try to load persisted memory first (for booking flow state), then overlay with conversation-based inference
    if (leadId) {
      try {
        const { loadLeadMemory } = await import('./aiConversationMemory');
        const mem = await loadLeadMemory(leadId);
        if (mem?.stateJson?.booking || mem?.stateJson?.currentFlow === 'tour_booking') {
          memoryContext = {
            summary: mem.summaryText || 'Practice conversation',
            state: mem.stateJson as any,
            recentTurns: []
          };
        }
      } catch (e) { /* ignore */ }
    }

    // Build/overlay from conversation history (property detection, flow inference)
    let practicePropertyId: string | undefined = memoryContext?.state?.propertyId ?? undefined;
    let practiceUnitId: string | undefined = memoryContext?.state?.unitId ?? undefined;
    
    // Look through recent conversations for property/unit mentions (both user and assistant)
    for (let i = conversations.length - 1; i >= 0 && i >= conversations.length - 10; i--) {
      const conv = conversations[i];
      const message = conv.message || '';
      const isUser = conv.type === 'incoming' || conv.type === 'received';
      // Try to extract property from message (user or assistant - AI may have stated the property address in a prior response)
      if (!practicePropertyId) {
          const propertyPatterns = [
            /(?:for|at|about|of|property you're asking about,?|located at|at)\s+([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
            /(?:for|at|about|of|qualifications?|requirements?)\s+([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
            /([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
            /^([0-9]+\s+[\w\s]+?)(?:\s|$|,|\.)/i,
          ];
          
          for (const pattern of propertyPatterns) {
            const match = message.match(pattern);
            if (match) {
              const propertyMention = match[1].trim();
              try {
                const allProperties = await storage.getAllProperties(orgId);
                const normalizeAddress = (addr: string): string => {
                  if (!addr) return '';
                  let normalized = addr.toLowerCase().trim();
                  const abbreviations: Record<string, string> = {
                    '\\bst\\b': 'street',
                    '\\bave\\b': 'avenue',
                    '\\brd\\b': 'road',
                    '\\bdr\\b': 'drive',
                    '\\bln\\b': 'lane',
                    '\\bblvd\\b': 'boulevard',
                    '\\bct\\b': 'court',
                    '\\bpl\\b': 'place',
                  };
                  for (const [abbrev, full] of Object.entries(abbreviations)) {
                    normalized = normalized.replace(new RegExp(abbrev, 'gi'), full);
                  }
                  normalized = normalized.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
                  return normalized;
                };
                
                const normalizedMention = normalizeAddress(propertyMention);
                const matchedProperty = allProperties.find((p: any) => {
                  const propAddress = (p.address || '').toLowerCase();
                  const propName = (p.name || '').toLowerCase();
                  const normalizedPropAddress = normalizeAddress(propAddress);
                  const normalizedPropName = normalizeAddress(propName);
                  return normalizedPropAddress.includes(normalizedMention) ||
                         normalizedMention.includes(normalizedPropAddress) ||
                         normalizedPropName.includes(normalizedMention) ||
                         normalizedMention.includes(normalizedPropName) ||
                         (normalizedMention.match(/^\d+/) && (normalizedPropAddress.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i')) || normalizedPropName.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i'))));
                });
                
                if (matchedProperty) {
                  practicePropertyId = matchedProperty.id;
                  break;
                }
              } catch (error) {
                // Continue
              }
            }
          }
        }
        
      // Try to extract unit number (user messages only)
      if (isUser && !practiceUnitId && practicePropertyId) {
        const unitMatch = message.match(/(?:unit|apt|apartment|#)\s*([A-Z0-9]+)/i);
        if (unitMatch) {
          const unitNumber = unitMatch[1];
          try {
            const propertyUnits = await storage.getAllUnitsByProperty(practicePropertyId, orgId);
            const matchedUnit = propertyUnits.find((u: any) => 
              u.unitNumber?.toLowerCase() === unitNumber.toLowerCase()
            );
            if (matchedUnit) {
              practiceUnitId = matchedUnit.id;
            }
          } catch (error) {
            // Continue
          }
        }
      }
    }
    
    // Infer lastAiQuestion and currentFlow from last assistant message (for flow continuation)
    let practiceLastAiQuestion: string | null = null;
    let practiceCurrentFlow: string | null = null;
    for (let i = conversations.length - 1; i >= 0; i--) {
      const conv = conversations[i];
      if (conv.type === 'outgoing' || conv.type === 'sent') {
        const msg = (conv.message || '').toLowerCase();
        // Slot selection step: "Here are some available times" + "Reply with the number (1-4)"
        if (msg.includes('reply with the number') || msg.includes('1-4') || (msg.includes('here are some available times') && msg.includes('at '))) {
          practiceLastAiQuestion = conv.message || null;
          practiceCurrentFlow = 'tour_booking';
          break;
        }
        if (msg.includes('which property') || msg.includes('what property')) {
          practiceLastAiQuestion = conv.message || null;
          if (msg.includes('nearby') || msg.includes('amenities') || msg.includes('parks') || msg.includes('grocery') || msg.includes('restaurants')) {
            practiceCurrentFlow = 'neighborhood';
          } else if (msg.includes('schedule') || msg.includes('tour')) {
            practiceCurrentFlow = 'scheduling';
          } else if (msg.includes('availability') || msg.includes('available')) {
            practiceCurrentFlow = 'availability';
          } else if (msg.includes('pricing') || msg.includes('rent')) {
            practiceCurrentFlow = 'pricing';
          }
          break;
        }
      }
    }

    // Build practice memory context (merge with loaded memory to preserve booking state)
    if (practicePropertyId || conversations.length > 0 || memoryContext) {
      const recentTurns = conversations.slice(-10).map((conv: any) => ({
        role: (conv.type === 'incoming' || conv.type === 'received') ? 'user' as const : 'assistant' as const,
        content: conv.message || ''
      }));
      const existingState = memoryContext?.state || {};
      memoryContext = {
        summary: practicePropertyId ? `Discussing property ${practicePropertyId}` : (memoryContext?.summary || 'Practice conversation'),
        state: {
          ...existingState,
          propertyId: practicePropertyId || existingState.propertyId,
          unitId: practiceUnitId || existingState.unitId,
          currentFlow: practiceCurrentFlow || existingState.currentFlow,
          lastIntent: practiceCurrentFlow || existingState.lastIntent,
          lastAiQuestion: practiceLastAiQuestion ?? existingState.lastAiQuestion,
          missingFields: existingState.missingFields,
        },
        recentTurns
      };
      
      console.log('[AI V2] Built practice mode memory context:', {
        propertyId: practicePropertyId,
        unitId: practiceUnitId,
        recentTurnsCount: recentTurns.length
      });
    }
  }

  // Detect property from message if not already set
  // PRIORITY: 1) lead.propertyId, 2) memory state propertyId, 3) detect from message
  let detectedPropertyId: string | undefined = lead?.propertyId || undefined;
  let detectedUnitId: string | undefined = undefined; // Declare at function scope for memory update
  
  // For Facebook leads, check metadata for unitId (from facebookListingId mapping)
  if (lead?.metadata && typeof lead.metadata === 'object') {
    const metadata = lead.metadata as any;
    if (metadata.unitId && !detectedUnitId) {
      detectedUnitId = metadata.unitId;
      console.log(`[AI V2] ✅ Using unitId from lead metadata (Facebook listing context): ${detectedUnitId}`);
    }
  }
  
  // Check memory state for propertyId from previous conversation
  if (!detectedPropertyId && memoryContext?.state?.propertyId) {
    detectedPropertyId = memoryContext.state.propertyId;
    console.log(`[AI V2] ✅ Using propertyId from conversation memory: ${memoryContext.state.propertyId}`);
  } else if (!detectedPropertyId) {
    console.log(`[AI V2] ⚠️  No propertyId detected. Memory state:`, memoryContext?.state);
  }
  
  // Also check recent conversation turns for property mentions if still not found
  if (!detectedPropertyId && memoryContext?.recentTurns) {
    for (const turn of memoryContext.recentTurns.slice().reverse()) {
      // Check if this turn mentioned a property
      if (turn.role === 'user' && turn.content) {
        // Try to extract property from this turn
        const propertyPatterns = [
          /(?:for|at|about|of|qualifications?|requirements?)\s+([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
          /([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
        ];
        
        for (const pattern of propertyPatterns) {
          const match = turn.content.match(pattern);
          if (match) {
            const propertyMention = match[1].trim();
            // Try to match this to a property
            try {
              const allProperties = await storage.getAllProperties(orgId);
              const normalizeAddress = (addr: string): string => {
                if (!addr) return '';
                let normalized = addr.toLowerCase().trim();
                const abbreviations: Record<string, string> = {
                  '\\bst\\b': 'street',
                  '\\bave\\b': 'avenue',
                  '\\brd\\b': 'road',
                  '\\bdr\\b': 'drive',
                  '\\bln\\b': 'lane',
                  '\\bblvd\\b': 'boulevard',
                  '\\bct\\b': 'court',
                  '\\bpl\\b': 'place',
                };
                for (const [abbrev, full] of Object.entries(abbreviations)) {
                  normalized = normalized.replace(new RegExp(abbrev, 'gi'), full);
                }
                normalized = normalized.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
                return normalized;
              };
              
              const normalizedMention = normalizeAddress(propertyMention);
              const matchedProperty = allProperties.find((p: any) => {
                const propAddress = (p.address || '').toLowerCase();
                const normalizedPropAddress = normalizeAddress(propAddress);
                return normalizedPropAddress.includes(normalizedMention) ||
                       normalizedMention.includes(normalizedPropAddress) ||
                       (normalizedMention.match(/^\d+/) && normalizedPropAddress.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i')));
              });
              
              if (matchedProperty) {
                detectedPropertyId = matchedProperty.id;
                console.log(`[AI V2] Detected property from recent conversation turn: "${propertyMention}" → ${matchedProperty.name || matchedProperty.address} (${matchedProperty.id})`);
                break;
              }
            } catch (error) {
              // Continue to next turn
            }
          }
        }
        if (detectedPropertyId) break;
      }
    }
  }
  
  // Finally, try to detect from current message if still not found
  // Skip for slot selection ("1", "2", "3. 2026-02-02 at 09:15", etc.) - these are not property addresses
  const msgTrimmed = leadMessage?.trim() || '';
  const isSlotSelectionMessage = /^[1-4]\s*$/i.test(msgTrimmed) || /^[1-4][.)\s\-].*at\s+\d{1,2}:\d{2}/i.test(msgTrimmed) || /^\d{4}-\d{2}-\d{2}\s+at\s+\d{1,2}:\d{2}/.test(msgTrimmed);
  if (!detectedPropertyId && leadMessage && !isSlotSelectionMessage) {
    try {
      // Normalize address variations (e.g., "Street" vs "St")
      const normalizeAddress = (addr: string): string => {
        if (!addr) return '';
        let normalized = addr.toLowerCase().trim();
        const abbreviations: Record<string, string> = {
          '\\bst\\b': 'street',
          '\\bave\\b': 'avenue',
          '\\brd\\b': 'road',
          '\\bdr\\b': 'drive',
          '\\bln\\b': 'lane',
          '\\bblvd\\b': 'boulevard',
          '\\bct\\b': 'court',
          '\\bpl\\b': 'place',
        };
        for (const [abbrev, full] of Object.entries(abbreviations)) {
          normalized = normalized.replace(new RegExp(abbrev, 'gi'), full);
        }
        normalized = normalized.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
        return normalized;
      };

      // Extract potential addresses from message using multiple patterns
      const patterns = [
        /(?:for|at|about|of|qualifications?|requirements?)\s+([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
        /([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))/i,
        /(?:for|at|about|of)\s+([0-9]+\s+[\w\s]+)/i,
        /^([0-9]+\s+[\w\s]+)/i,
      ];
      
      let propertyMention: string | null = null;
      for (const pattern of patterns) {
        const match = leadMessage.match(pattern);
        if (match) {
          propertyMention = match[1].trim();
          break;
        }
      }
      
      if (propertyMention) {
        const allProperties = await storage.getAllProperties(orgId);
        const normalizedMention = normalizeAddress(propertyMention);
        
        const matchedProperty = allProperties.find((p: any) => {
          const propAddress = (p.address || '').toLowerCase();
          const propName = (p.name || '').toLowerCase();
          const normalizedPropAddress = normalizeAddress(propAddress);
          const normalizedPropName = normalizeAddress(propName);
          return normalizedPropAddress.includes(normalizedMention) ||
                 normalizedMention.includes(normalizedPropAddress) ||
                 normalizedPropName.includes(normalizedMention) ||
                 normalizedMention.includes(normalizedPropName) ||
                 (normalizedMention.match(/^\d+/) && normalizedPropAddress.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i'))) ||
                 (normalizedMention.match(/^\d+/) && normalizedPropName.match(new RegExp(normalizedMention.replace(/\s+/g, '.*'), 'i')));
        });
        
        if (matchedProperty) {
          detectedPropertyId = matchedProperty.id;
          console.log(`[AI V2] Detected property from message: "${propertyMention}" → ${matchedProperty.name || matchedProperty.address} (${matchedProperty.id})`);
        } else {
          console.log(`[AI V2] No property matched for mention: "${propertyMention}" (normalized: "${normalizedMention}")`);
          console.log(`[AI V2] Available properties:`, allProperties.map(p => ({ name: p.name, address: p.address, id: p.id })));
        }
      }
    } catch (error) {
      console.error('[AI V2] Error detecting property from message:', error);
    }
  }

  // Load style profile if available
  const trainedArtifacts = await loadTrainedArtifacts(orgId, lead?.propertyId || undefined);
  const styleProfile = trainedArtifacts.enabled ? trainedArtifacts.styleProfile : null;

  // Step 1: Classify message intent (with memory context)
  // Use effective propertyId (from detection, lead, or memory)
  const effectivePropertyId = detectedPropertyId || lead?.propertyId || memoryContext?.state?.propertyId || undefined;
  console.log('[AI V2] Classifying message intent...', { 
    detectedPropertyId, 
    leadPropertyId: lead?.propertyId, 
    memoryPropertyId: memoryContext?.state?.propertyId,
    effectivePropertyId 
  });
  const intent = await classifyMessageIntent(openai, leadMessage, {
    hasProperty: !!effectivePropertyId,
    hasApplication: lead?.status === 'application' || lead?.status === 'approved',
    source: lead?.source,
    orgId,
    propertyId: effectivePropertyId
  }, memoryContext);

  console.log('[AI V2] Intent classification:', intent);

  // GUARDRAIL: STOP / don't text me → escalate to human
  const stopPattern = /\b(stop|don'?t text|do not text|unsubscribe|opt out|remove me)\b/i;
  if (stopPattern.test(leadMessage)) {
    return {
      answer: "I've noted your request. A team member will follow up to update your preferences.",
      sources: [],
      confidence: 'high',
      needsHuman: true,
    };
  }

  // GUARDRAIL: "Is it safe?" / crime questions → escalate to human (no crime/safety claims)
  const lowerMessage = leadMessage.toLowerCase();
  const safetyKeywords = /\b(safe|safety|crime|criminal|dangerous|violent)\b/i;
  if (intent.intent === 'neighborhood' && safetyKeywords.test(lowerMessage)) {
    return {
      answer: "I can't provide information about safety or crime statistics. I'd recommend checking official local sources like your city's police department or neighborhood crime mapping tools. Would you like to know about nearby amenities like grocery stores, parks, or transit options instead?",
      sources: [],
      confidence: 'medium',
      needsHuman: true,
      followUpQuestion: "Is there anything else about the area I can help with, like nearby restaurants or parks?",
    };
  }

  // Step 2: Handle unclear intent
  if (intent.intent === 'unclear' && intent.followUpQuestion) {
    // Off-topic (math, weather, etc.): gently redirect back to listings
    const isOffTopic = /\b(\d+\s*[x×*]\s*\d+|times\s*\d|what'?s\s+\d|weather|sports|recipe|joke|capital\s+of|president)\b/i.test(leadMessage) ||
      /^\s*\d+\s*[x×*+\-]\s*\d+\s*[=]?\s*$/i.test(leadMessage);
    const offTopicRedirect = "I'm bringing the conversation back to the listing — did you have any questions about our properties, availability, pricing, or qualifications?";
    return {
      answer: isOffTopic ? offTopicRedirect : intent.followUpQuestion,
      sources: [],
      confidence: 'low',
      needsHuman: false,
      followUpQuestion: isOffTopic ? offTopicRedirect : intent.followUpQuestion
    };
  }

  // Step 2b: Conversational tour booking flow (in-chat booking)
  const effectivePropId = detectedPropertyId || lead?.propertyId || memoryContext?.state?.propertyId || undefined;
  const bookingState = memoryContext?.state?.booking;
  const isInBookingFlow = memoryContext?.state?.currentFlow === 'tour_booking' || memoryContext?.state?.schedulingMode === 'in_chat';
  const bookNowPattern = /\b(book\s*(?:the|a)?\s*tour|book\s*now|book\s*it|schedule\s*it|set\s*it\s*up|yes\s*book|book\s*me|can you book|book here|in chat|confirm\s*(?:its?|the)\s*booked|confirm\s*the\s*booking)\b/i;
  const wantsInChat = bookNowPattern.test(leadMessage);

  // Run booking flow when: (a) intent is scheduling/tour_booking, OR (b) we're already in booking flow (contact_info/short "yes"/slot choice "1"-"4" may be misclassified)
  // CRITICAL: Do NOT run booking when lead explicitly asks about neighborhood (parks, nearby, area, etc.) — answer that question instead
  const isExplicitNeighborhoodQuestion = /\b(parks?|nearby|neighborhood|restaurants?|what'?s\s+(?:the\s+)?(?:area|around)|know\s+more\s+about\s+(?:the\s+)?(?:parks?|area|neighborhood)|area\s+amenities|grocery|transit|walkable|coffee|pharmacy|gym)\b/i.test(leadMessage);
  const isSlotChoice = /^[1-4]\s*$|^option\s*[1-4]\s*$/i.test(leadMessage.trim());
  const isShortConfirmation = /^(yes|yeah|sure|confirm|yep|ok)\s*$/i.test(leadMessage.trim());
  const shouldRunBookingFlow = effectivePropId && leadId && (
    intent.intent === 'scheduling' ||
    intent.intent === 'tour_booking' ||
    (isInBookingFlow && !isExplicitNeighborhoodQuestion && (intent.intent === 'contact_info' || isShortConfirmation || isSlotChoice))
  );

  if (shouldRunBookingFlow) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const handleBookingFlow = async () => {
      // User chose in-chat: collect contact, show slots, confirm, create
      if (wantsInChat || isInBookingFlow) {
        const extracted = extractContactFromMessage(leadMessage);
        // When in slot selection or confirmation step, fetch fresh lead data — contact was saved in prior turn
        let leadData: { name: string; email?: string; phone?: string };
        if (leadId && (bookingState?.lastOfferedSlots || bookingState?.pendingConfirmation || isSlotChoice)) {
          const freshLead = await storage.getLead(leadId, orgId);
          if (freshLead && (freshLead.name || freshLead.email || freshLead.phone)) {
            leadData = { name: freshLead.name || '', email: freshLead.email || undefined, phone: freshLead.phone || undefined };
          } else {
            leadData = lead ? { name: lead.name, email: lead.email || undefined, phone: lead.phone || undefined } : { name: '', email: '', phone: '' };
          }
        } else {
          leadData = lead ? { name: lead.name, email: lead.email || undefined, phone: lead.phone || undefined } : { name: '', email: '', phone: '' };
        }
        const hasName = !!(bookingState ? (leadData.name || extracted.name) : (leadData.name || extracted.name));
        const hasEmail = !!(bookingState ? (leadData.email || extracted.email) : (leadData.email || extracted.email));
        const hasPhone = !!(bookingState ? (leadData.phone || extracted.phone) : (leadData.phone || extracted.phone));

        if (!hasName || !hasEmail || !hasPhone) {
          if (extracted.name || extracted.email || extracted.phone) {
            const upsertResult = await executeTool('upsert_lead_contact', {
              leadId,
              name: extracted.name || leadData.name,
              email: extracted.email || leadData.email,
              phone: extracted.phone || leadData.phone,
            }, orgId, leadId);
            if (upsertResult.success && upsertResult.data) {
              const d = upsertResult.data as { name?: string; email?: string; phone?: string; missing?: string[] };
              const stillMissing = d.missing || [];
              if (stillMissing.length > 0) {
                const missingStr = stillMissing.join(', ');
                return {
                  answer: `Thanks! I still need your ${missingStr}. Please share so I can complete the booking.`,
                  sources: [{ type: 'tool' as const, name: 'upsert_lead_contact' }],
                  confidence: 'high' as const,
                  needsHuman: false,
                  followUpQuestion: `What's your ${missingStr}?`,
                  toolResults: [{ toolName: 'upsert_lead_contact', success: true, data: upsertResult.data }],
                  action: { type: 'collect_contact' as const },
                };
              }
            }
          } else {
            return {
              answer: "I can book your tour right here! To complete the booking, I'll need your name, email, and phone number. What are they?",
              sources: [],
              confidence: 'high' as const,
              needsHuman: false,
              followUpQuestion: "Please share your name, email, and phone so I can complete the booking.",
              action: { type: 'collect_contact' as const },
            };
          }
        }

        const contactComplete = hasName && hasEmail && hasPhone;
        if (contactComplete) {
          const slotsResult = await executeTool('get_tour_slots', { propertyId: effectivePropId, unitId: memoryContext?.state?.unitId || undefined }, orgId, leadId);
          const slots = (slotsResult.data?.availableSlots as Array<{ slotId: string; date: string; time: string }>) || [];
          const lastOffered = bookingState?.lastOfferedSlots;
          const slotIds = lastOffered?.slotIds || slots.slice(0, 4).map((s: any) => s.slotId).filter(Boolean);

          const lowerMsg = leadMessage.toLowerCase().trim();
          // Match: "1", "3", "option 2"; "3. 2026-02-02 at 09:15"; "3)"; "3 -"; or literal slotId/date-time
          const slotChoiceMatch = lowerMsg.match(/^([1-4])\s*$|^option\s*([1-4])\s*$|^#?([1-4])\s*$/i) ||
            lowerMsg.match(/^([1-4])[.)\s\-]/);
          let selectedSlotId: string | undefined;
          if (typeof slotChoiceMatch === 'object' && slotChoiceMatch) {
            const num = parseInt(slotChoiceMatch[1] || slotChoiceMatch[2] || slotChoiceMatch[3] || '0', 10);
            if (num >= 1 && num <= slotIds.length) selectedSlotId = slotIds[num - 1];
          } else if (slotIds.length >= 1) {
            for (let i = 0; i < slotIds.length; i++) {
              const sid = slotIds[i];
              const sidWithSpace = sid.replace('_', ' ');
              const sidWithAt = sid.replace('_', ' at ');
              if (lowerMsg.includes(sid) || lowerMsg.includes(sidWithSpace) || lowerMsg.includes(sidWithAt)) {
                selectedSlotId = sid;
                break;
              }
            }
          }

          const confirmYes = /^(yes|yeah|sure|confirm|yep|ok)\b/i.test(lowerMsg.trim());
          const pendingConfirm = bookingState?.pendingConfirmation && bookingState?.slotId;

          if (pendingConfirm && confirmYes && bookingState?.slotId) {
            const upsertRes = await executeTool('upsert_lead_contact', {
              leadId,
              name: leadData.name || extracted.name,
              email: leadData.email || extracted.email,
              phone: leadData.phone || extracted.phone,
            }, orgId, leadId);
            const contactData = (upsertRes.data as any) || {};
            const name = contactData.name || leadData.name || 'Lead';
            const email = contactData.email || leadData.email || '';
            const phone = contactData.phone || leadData.phone || '';
            if (!email || !phone) {
              return {
                answer: "I need your email and phone to complete the booking. Please share them.",
                sources: [],
                confidence: 'medium' as const,
                needsHuman: false,
                followUpQuestion: "What's your email and phone?",
                action: { type: 'collect_contact' as const },
              };
            }
            const idempotencyKey = crypto.createHash('sha256').update(`${leadId}_${bookingState.slotId}_${bookingState.slotId.split('_')[0]}`).digest('hex').slice(0, 64);
            const createRes = await executeTool('create_tour_booking', {
              leadId,
              propertyId: effectivePropId,
              unitId: memoryContext?.state?.unitId || undefined,
              slotId: bookingState.slotId,
              contact: { name, email, phone },
              idempotencyKey,
            }, orgId, leadId);
            if (createRes.success && createRes.data) {
              const d = createRes.data as { bookingId: string; startTimeISO: string; locationText?: string; rescheduleUrl?: string };
              return {
                answer: `Your tour is booked! We'll see you at the scheduled time. ${d.locationText ? `Location: ${d.locationText}. ` : ''}${d.rescheduleUrl ? `You can reschedule here: ${d.rescheduleUrl}` : ''}`,
                sources: [{ type: 'tool' as const, name: 'create_tour_booking' }],
                confidence: 'high' as const,
                needsHuman: false,
                toolResults: [
                  { toolName: 'upsert_lead_contact', success: true },
                  { toolName: 'create_tour_booking', success: true, data: createRes.data },
                ],
                action: { type: 'booking_created' as const, bookingId: d.bookingId, slotId: bookingState.slotId },
              };
            } else {
              return {
                answer: "I wasn't able to complete the booking. The slot may no longer be available. Would you like to try another time, or use our booking link?",
                sources: [],
                confidence: 'low' as const,
                needsHuman: true,
                toolResults: createRes ? [{ toolName: 'create_tour_booking', success: false, error: (createRes as any).error }] : [],
              };
            }
          }

          if (selectedSlotId && !pendingConfirm) {
            const [d, t] = selectedSlotId.split('_');
            const friendlyTime = t ? `${t.slice(0, 2)}:${t.slice(2)}` : t;
            return {
              answer: `Got it — ${d} at ${friendlyTime}. Confirm this time?`,
              sources: [],
              confidence: 'high' as const,
              needsHuman: false,
              followUpQuestion: "Reply yes to confirm, or no to pick another slot.",
              action: { type: 'confirm_booking' as const, slotId: selectedSlotId },
            };
          }

          if (slots.length > 0 && !lastOffered) {
            const displaySlots = slots.slice(0, 4).map((s: any, i: number) => `${i + 1}. ${s.date} at ${s.time}`).join('\n');
            return {
              answer: `Here are some available times:\n\n${displaySlots}\n\nReply with the number (1-4) or the date/time you prefer.`,
              sources: [{ type: 'tool' as const, name: 'get_tour_slots' }],
              confidence: 'high' as const,
              needsHuman: false,
              followUpQuestion: "Which slot works for you?",
              toolResults: [{ toolName: 'get_tour_slots', success: true, data: slotsResult.data }],
              action: { type: 'offer_booking_options' as const, slotId: slotIds[0] },
            };
          }
        }
      }
      return null;
    };
    const bookingResult = await handleBookingFlow();
    if (bookingResult) {
      const stateOverrides: any = {};
      if (bookingResult.action?.type === 'collect_contact') {
        stateOverrides.currentFlow = 'tour_booking';
        stateOverrides.schedulingMode = 'in_chat';
        stateOverrides.booking = { propertyId: effectivePropId, unitId: memoryContext?.state?.unitId, schedulingMode: 'in_chat' };
      } else if (bookingResult.action?.type === 'confirm_booking' && bookingResult.action?.slotId) {
        stateOverrides.booking = { ...bookingState, slotId: bookingResult.action.slotId, pendingConfirmation: true, propertyId: effectivePropId };
        stateOverrides.currentFlow = 'tour_booking';  // Preserve flow so "yes" confirmation is recognized
      } else if (bookingResult.action?.type === 'offer_booking_options' && bookingResult.toolResults?.some(r => r.toolName === 'get_tour_slots')) {
        const tr = bookingResult.toolResults.find(r => r.toolName === 'get_tour_slots');
        const slots = (tr && 'data' in tr && tr.data && (tr.data as any).availableSlots) ? (tr.data as any).availableSlots : [];
        const slotIds = slots.slice(0, 4).map((s: any) => s.slotId).filter(Boolean);
        stateOverrides.booking = { ...bookingState, lastOfferedSlots: { slotIds, shownAt: new Date().toISOString() }, propertyId: effectivePropId };
        stateOverrides.currentFlow = 'tour_booking';  // Preserve flow so slot selection "1"-"4" is recognized
      } else if (bookingResult.action?.type === 'booking_created') {
        stateOverrides.booking = undefined;
        stateOverrides.currentFlow = null;
        stateOverrides.schedulingMode = undefined;
      }
      if (Object.keys(stateOverrides).length > 0 && leadId) {
        const { updateMemoryFromResponse } = await import('./aiConversationMemory');
        const { loadLeadMemory } = await import('./aiConversationMemory');
        const mem = await loadLeadMemory(leadId);
        await updateMemoryFromResponse(leadId, bookingResult as any, mem, bookingResult.toolResults || [], intent.intent, stateOverrides);
      }
      return bookingResult;
    }
  }

  // Step 3: Route to appropriate knowledge lane
  let toolResults: Array<{ toolName: string; success: boolean; data?: any; error?: string }> = [];
  let ragContext = '';
  let answerContext = '';

  if (intent.intent === 'qualifications') {
    // Lane B: Tool calling for qualifications (property-specific or org-level)
    console.log('[AI V2] Using tools lane for qualifications question');
    
    const toolCalls: Array<{ name: string; args: any }> = [{
      name: 'get_qualifications',
      args: {
        propertyId: detectedPropertyId || lead?.propertyId || undefined
      }
    }];

    // Execute tool call
    for (const toolCall of toolCalls) {
      console.log('[AI V2] Executing tool:', toolCall.name, toolCall.args);
      const result = await executeTool(toolCall.name, toolCall.args, orgId, leadId);
      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        data: result.data,
        error: result.error
      });

      if (result.success && result.data !== undefined) {
        console.log(`[AI V2] Tool ${toolCall.name} succeeded:`, JSON.stringify(result.data).substring(0, 300));
        answerContext += `\n${toolCall.name.toUpperCase()} RESULT:\n${JSON.stringify(result.data, null, 2)}\n\n`;
        
        // Add explicit instruction for empty results
        if (toolCall.name === 'get_qualifications' && result.data.qualifications && Array.isArray(result.data.qualifications) && result.data.qualifications.length === 0) {
          answerContext += `\nIMPORTANT: No qualification requirements found. Inform the lead that no specific qualification requirements have been set.\n\n`;
        }
      } else if (result.error) {
        console.log(`[AI V2] Tool ${toolCall.name} failed:`, result.error);
        answerContext += `\n${toolCall.name.toUpperCase()} ERROR: ${result.error}\n\n`;
      }
    }
  } else if (intent.intent === 'faq_policy') {
    // Lane A: RAG retrieval (TODO: implement vector store)
    // For now, fetch from database as fallback
    console.log('[AI V2] Using RAG lane for FAQ/policy question');

    // Get organization settings (brand voice, policies)
    const orgAISettings = await storage.getAISettings('organization', orgId);
    const policies = orgAISettings.find(s => s.key === 'policies')?.value;
    const brandVoice = orgAISettings.find(s => s.key === 'brand_voice')?.value;

    // Build policy context (this will be replaced with vector retrieval)
    ragContext = `POLICY AND FAQ INFORMATION:\n\n`;

    if (policies) {
      ragContext += `ORGANIZATION POLICIES:\n${policies}\n`;
    }

    if (brandVoice) {
      ragContext += `\nBRAND VOICE:\n${brandVoice}\n`;
    }

    answerContext = ragContext;
  } else if (intent.intent === 'portfolio_units') {
    // Lane B: Tool calling for portfolio listing
    console.log('[AI V2] Using tools lane for portfolio_units');
    
    const toolCalls: Array<{ name: string; args: any }> = [{
      name: 'list_portfolio_units',
      args: {
        propertyId: lead?.propertyId || undefined
      }
    }];

    // Execute tool calls
    for (const toolCall of toolCalls) {
      console.log('[AI V2] Executing tool:', toolCall.name, toolCall.args);
      const result = await executeTool(toolCall.name, toolCall.args, orgId, leadId);
      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        data: result.data,
        error: result.error
      });

      if (result.success && result.data !== undefined) {
        console.log(`[AI V2] Tool ${toolCall.name} succeeded:`, JSON.stringify(result.data).substring(0, 300));
        answerContext += `\n${toolCall.name.toUpperCase()} RESULT:\n${JSON.stringify(result.data, null, 2)}\n\n`;
      } else if (result.error) {
        console.log(`[AI V2] Tool ${toolCall.name} failed:`, result.error);
        answerContext += `\n${toolCall.name.toUpperCase()} ERROR: ${result.error}\n\n`;
      }
    }
  } else {
    // Lane B: Tool calling for real-time data
    console.log('[AI V2] Using tools lane for', intent.intent);

    // TOOL PLANNING: Decide which tools to call before execution
    const { planToolCalls, sanityCheckToolResult, detectUnitFromMessage } = await import('./aiToolPlanning');
    // detectedUnitId is already declared at function scope above
    
    // Use propertyId from memory if available (for flow continuation)
    const memoryPropertyId = memoryContext?.state?.propertyId;
    const effectivePropertyId = detectedPropertyId || lead?.propertyId || memoryPropertyId || undefined;
    
    // Use unitId from memory if available
    const memoryUnitId = memoryContext?.state?.unitId;
    if (memoryUnitId && !detectedUnitId) {
      detectedUnitId = memoryUnitId;
      console.log(`[AI V2] Using unitId from conversation memory: ${memoryUnitId}`);
    }
    
    // Store detectedUnitId in outer scope for memory update later
    // (detectedPropertyId is already in outer scope)
    
    const toolPlans = planToolCalls(intent.intent, {
      propertyId: effectivePropertyId,
      unitId: detectedUnitId || memoryUnitId || undefined,
      leadId: leadId || undefined,
      leadMessage: leadMessage
    });

    console.log('[AI V2] Tool plans:', toolPlans.map(p => ({ name: p.toolName, reason: p.reason, required: p.required })));

    // Determine which tools to call based on intent and plans
    const toolCalls: Array<{ name: string; args: any }> = [];

    // Build tool calls from plans
    for (const plan of toolPlans) {
      if (plan.required || (plan.toolName === 'list_portfolio_units' && intent.intent === 'pricing' && !detectedUnitId)) {
        // For pricing without unitId, we need to list units first to detect unit
        if (plan.toolName === 'list_portfolio_units' && intent.intent === 'pricing') {
          // Execute this tool first to get units for detection
          const listResult = await executeTool(plan.toolName, plan.args, orgId, leadId);
          if (listResult.success && listResult.data && listResult.data.units) {
            // Try to detect unit from message
            const detectedUnitIdFromMessage = detectUnitFromMessage(leadMessage, listResult.data.units);
            if (detectedUnitIdFromMessage) {
              detectedUnitId = detectedUnitIdFromMessage;
              toolCalls.push({
                name: 'quote_price',
                args: { unitId: detectedUnitId }
              });
            } else if (listResult.data.units.length === 1) {
              // Only one unit, use it
              toolCalls.push({
                name: 'quote_price',
                args: { unitId: listResult.data.units[0].unitId }
              });
            }
          }
        } else {
          toolCalls.push({
            name: plan.toolName,
            args: plan.args
          });
        }
      }
    }
    
    // Fallback to original logic if no plans (backward compatibility)
    if (toolCalls.length === 0) {
      console.log('[AI V2] No tool plans, using fallback logic. effectivePropertyId:', effectivePropertyId, 'intent:', intent.intent);
      
      // Use switch to avoid type narrowing issues
      switch (intent.intent) {
        case 'availability':
          toolCalls.push({
            name: 'get_availability',
            args: {
              propertyId: effectivePropertyId,
              unitId: undefined
            }
          });
          break;
        case 'scheduling':
        case 'tour_booking':
          if (effectivePropertyId) {
            console.log('[AI V2] Fallback: Adding get_tour_slots with propertyId:', effectivePropertyId);
            toolCalls.push({
              name: 'get_tour_slots',
              args: {
                propertyId: effectivePropertyId,
                unitId: detectedUnitId || memoryContext?.state?.unitId || undefined
              }
            });
          }
          break;
        case 'application_status':
          if (leadId) {
            toolCalls.push({
              name: 'get_application_status',
              args: { leadId: leadId }
            });
          }
          break;
      }
      
      // Handle other intents that may not be in the union type
      const intentStr = intent.intent as string;
      if (intentStr === 'qualifications') {
        toolCalls.push({
          name: 'get_qualifications',
          args: { propertyId: effectivePropertyId }
        });
      } else if (intentStr === 'portfolio_units') {
        toolCalls.push({
          name: 'list_portfolio_units',
          args: { propertyId: effectivePropertyId }
        });
      } else if (intentStr === 'contact_info') {
        toolCalls.push({
          name: 'get_property_contact_info',
          args: { propertyId: effectivePropertyId, unitId: detectedUnitId || memoryContext?.state?.unitId }
        });
      }
    }

    // Execute tool calls with sanity checks
    for (const toolCall of toolCalls) {
      console.log('[AI V2] Executing tool:', toolCall.name, toolCall.args);
      const result = await executeTool(toolCall.name, toolCall.args, orgId, leadId);
      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        data: result.data,
        error: result.error
      });

      // TOOL RESULT SANITY CHECK
      const effectivePropertyId = detectedPropertyId || lead?.propertyId || memoryContext?.state?.propertyId || undefined;
      const effectiveUnitId = detectedUnitId || memoryContext?.state?.unitId || undefined;
      const sanityCheck = sanityCheckToolResult(toolCall.name, result, {
        propertyId: effectivePropertyId,
        unitId: effectiveUnitId,
        intent: intent.intent
      });
      
      if (!sanityCheck.passed) {
        console.warn(`[AI V2] ⚠️ Sanity check failed for ${toolCall.name}:`, sanityCheck.warning);
        if (sanityCheck.shouldEscalate) {
          // Mark for human escalation - don't add to answerContext
          continue;
        }
      }

      if (result.success && result.data !== undefined) {
        console.log(`[AI V2] Tool ${toolCall.name} succeeded:`, JSON.stringify(result.data).substring(0, 300));
        answerContext += `\n${toolCall.name.toUpperCase()} RESULT:\n${JSON.stringify(result.data, null, 2)}\n\n`;
        
        // Add sanity check warnings to context if needed
        if (sanityCheck.warning && !sanityCheck.shouldEscalate) {
          answerContext += `\nNOTE: ${sanityCheck.warning}\n\n`;
        }
        
        // Add explicit instruction for empty results
        if (toolCall.name === 'get_availability') {
          if (result.data.properties && Array.isArray(result.data.properties) && result.data.properties.length === 0) {
            answerContext += `\nIMPORTANT: The tool returned an empty array of properties. This means there are currently NO available units in the portfolio. Inform the lead politely that we don't have any available units right now, but they can check back later or provide their contact information for future availability. Do NOT say there was an error or issue - this is valid data.\n\n`;
          } else if (result.data.availableUnits && Array.isArray(result.data.availableUnits) && result.data.availableUnits.length === 0) {
            answerContext += `\nIMPORTANT: The tool returned an empty array of availableUnits for this property. This means there are currently NO available units for this property. Inform the lead politely. Do NOT say there was an error.\n\n`;
          } else if (result.data.hasAvailableUnits === false) {
            answerContext += `\nIMPORTANT: The tool returned hasAvailableUnits: false. This means there are currently NO available units. Inform the lead politely. Do NOT say there was an error.\n\n`;
          } else {
            // Use availabilityStatus and nextAvailableDate to provide accurate information
            answerContext += `\nIMPORTANT: Use the property and unit information above to provide a helpful response about available units. 
- For availability questions: A unit is "available" if it's listed (isListed === true). Occupancy status does NOT matter.
- If availabilityStatus is 'available_now', say the unit is available now
- If availabilityStatus is 'future' and nextAvailableDate is provided, say when it will be available
- If isListed is true but availabilityStatus is 'future', clarify that it's listed but not available until the date shown
- List the properties and their available units clearly.
- NOTE: Occupancy status is NOT relevant for availability questions. As long as a unit is listed, it's available for inquiries.\n\n`;
          }
        }
        if (toolCall.name === 'get_tour_slots' && result.data) {
          // Extract unique dates from availableSlots
          const uniqueDates = result.data.availableSlots 
            ? [...new Set(result.data.availableSlots.map((slot: any) => slot.date))]
            : [];
          const bookingLink = result.data.bookingLink;
          const wantsChatOnly = /\b(book\s+through\s+chat|book\s+in\s+chat|in\s+chat|through\s+chat)\b/i.test(leadMessage);
          
          answerContext += `\nIMPORTANT (get_tour_slots): 
1. NEVER say "You can visit the property on X" - that implies walk-in without booking. Say "You can schedule a tour for" or "Available times to book:" instead.
2. Only mention the exact days and times from the data above. Use availableSlots (date and time). Do NOT add other days.
3. Present the FULL TIME RANGE for each date. If slots span 9:00 AM to 12:00 PM, say "9 AM - 12 PM" or "9:00 AM through 12:00 PM".
4. MULTIPLE DATES: Present ALL dates (${uniqueDates.length} found). Example: "We have availability on Monday, February 2nd (9 AM - 12 PM), Monday, February 9th (9 AM - 12 PM)."
5. BOOKING LINK: ${bookingLink ? `Use this EXACT URL in your response - copy it verbatim: ${bookingLink}. NEVER use example.com or placeholder URLs.` : 'No booking link - offer to book in chat only.'}
6. ${wantsChatOnly ? 'The lead chose to book through chat. Do NOT re-offer the link or both options. Say "Great! Please share your name, email, and phone number so I can complete the booking." and list the available slots.' : 'Offer BOTH: (1) the booking link from above, AND (2) "Or I can book it here in chat — just share your name, email, and phone."'}
7. NEVER end with "I would be delighted to assist" without slots and next steps. Provide actual availability and booking option.
\n`;
        }
        if (toolCall.name === 'get_property_contact_info' && result.data) {
          answerContext += `\nIMPORTANT (get_property_contact_info): Use the data above to answer. State the organizationName as the company/property management company. If assignedMembers is not empty, name the leasing agent(s) who will show the property (use the "name" field; do not expose email unless the lead asks). If no assigned members, you can say tours are conducted by our team or contact the office.\n\n`;
        }
        if (toolCall.name === 'get_nearby_places_openai' && result.data) {
          answerContext += `\nIMPORTANT (get_nearby_places_openai): Present nearby places grouped by category (max 3 per category). Include the disclaimer: "Nearby options are based on public web listings; please verify hours." Add a follow-up: "Would you prefer to know about walkability, commute options, or family-friendly spots?" Do NOT store the places list in memory. Do NOT claim crime/safety. If partial=true, say results are limited and suggest verifying locally.\n\n`;
        }
        
        // Add follow-up question from sanity check if provided
        if (sanityCheck.followUpQuestion) {
          // Will be set in validated.followUpQuestion below
        }
      } else if (result.error) {
        console.log(`[AI V2] Tool ${toolCall.name} failed:`, result.error);
        answerContext += `\n${toolCall.name.toUpperCase()} ERROR: ${result.error}\n\n`;
      } else if (result.success && result.data === undefined) {
        console.log(`[AI V2] Tool ${toolCall.name} succeeded but returned undefined data`);
        answerContext += `\n${toolCall.name.toUpperCase()} RESULT: Tool executed successfully but returned no data.\n\n`;
      }
    }

    // No tour slots available: return specific message for scheduling/tour_booking
    if (intent.intent === 'scheduling' || intent.intent === 'tour_booking') {
      const tourSlotsResult = toolResults.find(r => r.toolName === 'get_tour_slots');
      if (tourSlotsResult?.success && tourSlotsResult.data) {
        const slots = tourSlotsResult.data.availableSlots;
        const hasSlots = tourSlotsResult.data.hasSlots;
        const noSlots = !slots || !Array.isArray(slots) || slots.length === 0 || hasSlots === false;
        if (noSlots) {
          return {
            answer: "Sorry, we have no available tour slots at this time.",
            sources: [{ type: 'tool' as const, name: 'get_tour_slots' }],
            confidence: 'high' as const,
            needsHuman: false,
            toolResults,
          };
        }
      }
    }

    // GUARDRAIL: For availability/pricing/scheduling/tour_booking/portfolio_units/neighborhood, if no tool was called or all failed, escalate gracefully
    if (['availability', 'pricing', 'scheduling', 'tour_booking', 'portfolio_units', 'neighborhood'].includes(intent.intent)) {
      const hasSuccessfulTool = toolResults.some(r => r.success);
      if (!hasSuccessfulTool && toolResults.length > 0) {
        // All tools failed - hand off to human with a friendly message (never expose technical failures to the lead)
        console.log('[AI V2] ⚠️ All tools failed for', intent.intent, '- escalating to human');
        const friendlyFallback: Record<string, string> = {
          scheduling: "Sorry, we have no available tour slots at this time.",
          tour_booking: "Sorry, we have no available tour slots at this time.",
          availability: "I'd be glad to check availability for you. Our team will follow up with the latest information shortly.",
          pricing: "Our team will get back to you with pricing details shortly.",
          neighborhood: "I'd love to share what's nearby! Our team will follow up with area information shortly.",
          portfolio_units: "Our team will send you our current listings shortly.",
        };
        const fallbackMsg = friendlyFallback[intent.intent] || "Thanks for reaching out! Our team will follow up with you shortly.";
        return {
          answer: fallbackMsg,
          sources: toolResults.map(r => ({
            type: 'tool' as const,
            name: r.toolName,
            reference: r.error || 'failed'
          })),
          confidence: 'low',
          needsHuman: true,
          toolResults
        };
      } else if (toolCalls.length === 0) {
        // Required fields missing - ask follow-up
        const followUp = intent.intent === 'availability' 
          ? "Which property are you interested in? I can check availability for you."
          : intent.intent === 'pricing'
          ? "Which property or unit are you asking about? I can provide current pricing information."
          : intent.intent === 'scheduling' || intent.intent === 'tour_booking'
          ? "Which property would you like to schedule a tour for? I can show you available times."
          : intent.intent === 'neighborhood'
          ? "Which property are you asking about? I can tell you about nearby amenities like grocery stores, restaurants, and parks."
          : "Which property are you interested in? I can help with availability, pricing, or scheduling.";
        
        return {
          answer: followUp,
          sources: [],
          confidence: 'low',
          needsHuman: false,
          followUpQuestion: followUp,
          toolResults: []
        };
      }
    }
  }

  // Build style instructions from personality settings + style profile
  const styleInstructions = buildStyleInstructions(personalitySettings, styleProfile);

  // Determine max sentences for post-processing
  const maxSentences = personalitySettings.responseLength === 'one-paragraph' ? 5 
    : personalitySettings.responseLength === 'short' ? 6 
    : undefined;

  // Step 4: Generate structured response
  const systemPrompt = `You are an AI Leasing Agent assistant. Your role is to help leads with property inquiries, availability, pricing, scheduling, and policy questions.

${getGuardrailInstructions()}

${styleInstructions}

CRITICAL - RESPONSE TIMING (the AI never sends a follow-up message; this is the ONLY response the lead sees):
- NEVER say "let me check", "I'll check", "give me a moment", "hang tight", "one moment", "let me look that up", or any phrase suggesting you are fetching data
- You already have all the information from the tools that were executed. Provide the COMPLETE answer now in one response
- Do NOT end with "Let me check..." or "I'll get back to you" — include the actual slots, link, or answer in THIS message

CRITICAL: When get_availability tool returns success: true:
- NEVER say "yes, it's available" without the tool having been called and confirming availability. If we don't know which property (no Facebook listing, no memory), ask "Which property are you inquiring about?"
- If the lead came from a listing (Facebook, etc.) and asks "Is this available?" and the tool confirmed availability: Say "Yes, this is available! Do you have any questions in particular or would you like to book a tour?"
- If it returns properties array with units and lead does NOT have a known listing: list them clearly
- If it returns empty properties array ([]), this is VALID DATA meaning no units available - say "We currently don't have any available units, but I'd be happy to let you know when something becomes available"
- If it returns hasAvailableUnits: false, inform the lead there are no available units
- NEVER say "I'm unable to provide" or "there seems to be an issue" when the tool succeeded - empty results are valid data

You MUST respond using the structured output format with:
- answer: Natural language response grounded in the provided context
- sources: List every source used (tools, documents, policies)
- confidence: Your confidence level based on how well-grounded your answer is
- needsHuman: True if this should be escalated
- followUpQuestion: Optional if you need clarification`;

  // Build conversation context from memory if available
  let conversationContextStr = '';
  
  // Add property context when we know which property we're discussing (for "what property did I inquire about?" etc.)
  const contextPropertyId = detectedPropertyId || lead?.propertyId || memoryContext?.state?.propertyId;
  if (contextPropertyId) {
    try {
      const prop = await storage.getProperty(contextPropertyId, orgId);
      if (prop) {
        conversationContextStr += `\n\nKNOWN CONTEXT: We are discussing the property "${prop.name}" at ${prop.address || 'unknown address'}. When the lead asks "what property did I inquire about?" or "which property?", use this: ${prop.name}.`;
      }
    } catch {
      // Ignore - property lookup is best-effort
    }
  }
  
  if (memoryContext) {
    if (memoryContext.summary) {
      conversationContextStr += `\n\nCONVERSATION SUMMARY:\n${memoryContext.summary}`;
    }
    if (memoryContext.recentTurns && memoryContext.recentTurns.length > 0) {
      conversationContextStr += `\n\nRECENT CONVERSATION:\n${memoryContext.recentTurns.slice(-5).map(t => 
        `${t.role === 'user' ? 'Lead' : 'AI'}: ${t.content}`
      ).join('\n')}`;
    }
  } else if (conversations.length > 0) {
    conversationContextStr += `\n\nCONVERSATION HISTORY:\n${conversations.slice(-5).map((c: any) => 
      `${c.type === 'incoming' || c.type === 'received' ? 'Lead' : 'You'}: ${c.message}`
    ).join('\n')}\n`;
  }

  // Sanitize tool results to prevent JSON injection
  const sanitizedAnswerContext = answerContext
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')
    .substring(0, 5000); // Cap length

  // Add context if lead is inquiring about a specific unit (from Facebook listing context)
  const hasListingContext = !!(detectedUnitId && lead?.propertyId);
  let leadUnitContext = '';
  if (hasListingContext) {
    leadUnitContext = `\n\nIMPORTANT CONTEXT - FACEBOOK/LISTING INQUIRY: This lead came from a listing (Facebook or similar). They ALREADY KNOW the property. When they ask "Is this available?" or "Is this still available?": ONLY say "Yes, this is available! Do you have any questions in particular or would you like to book a tour?" if get_availability was called THIS TURN and returned that the unit IS available. If the tool was not called or returned no/empty, do NOT say yes - ask which property or say you need to check. Do NOT mention address, bedrooms, rent, or add filler.`;
  }

  const bookingWasCreated = toolResults.some(r => r.toolName === 'create_tour_booking' && r.success);
  const bookingClaimInstruction = !bookingWasCreated && (intent.intent === 'scheduling' || intent.intent === 'tour_booking' || intent.intent === 'contact_info')
    ? `\n\nCRITICAL - NO BOOKING CREATED: The create_tour_booking tool was NOT executed this turn. Therefore you must NEVER say "I've booked", "your tour is confirmed", "I've confirmed your tour", "I will secure it", "tour is booked", or any phrase implying the booking is done. Instead say what's needed next: e.g. "Reply 'yes' to confirm and I'll finalize the booking" or "I still need your phone number to complete the booking" or list the slot and ask them to confirm. Do NOT claim the tour is booked until create_tour_booking has actually run.`
    : '';

  const userPrompt = `Lead's Message: "${leadMessage}"${conversationContextStr}${leadUnitContext}${bookingClaimInstruction}

${answerContext ? `CONTEXT DATA:\n${sanitizedAnswerContext}\n` : ''}

CRITICAL INSTRUCTIONS:
- NEVER say "yes, this is available" or "yes, it's available" without get_availability having been called and returned that the unit IS available. You MUST verify via the tool first.
- If the lead asks "Is this available?" but we do NOT have property/unit context (no Facebook listing, no property in memory): Do NOT assume. Ask "Which property are you inquiring about?"
- If we HAVE property/unit context (Facebook listing or memory) AND get_availability confirmed the unit is available: Say "Yes, this is available! Do you have any questions in particular or would you like to book a tour?"
- If get_availability tool returned data with properties/availableUnits, use that data to answer the lead's question about available units
- If get_availability returned an empty array (no available units), inform the lead politely that we currently don't have available units, but they can check back later
- If get_availability returned hasAvailableUnits: false, inform the lead that there are no available units at this time
- If list_portfolio_units tool returned data, list all properties and units clearly
- If get_property_contact_info tool returned data: State the organizationName as the company/property management company. If assignedMembers has entries, name the leasing agent(s) who will show the property (use the name field). Example: "123 Main St is managed by [organizationName]. Your tour would be conducted by [assigned member name(s)]."
- When the lead asks "what property did I inquire about?" or "which property was I asking about?": Use the KNOWN CONTEXT above (property name and address). We are discussing that specific property - state it clearly (e.g., "You inquired about [property name/address]").
- For get_nearby_places_openai: Present groups (grocery, coffee, restaurants, pharmacy, parks, transit, gym) with max 3 places per category. Always include: "Nearby options are based on public web listings; please verify hours." Ask follow-up: "Would you prefer to know about walkability, commute options, or family-friendly spots?" Do NOT claim crime/safety.
- If get_tour_slots returned a bookingLink in CONTEXT DATA, use that EXACT URL - copy it verbatim. NEVER use example.com, placeholder URLs, or "123" as property ID. The real link is in the tool result.
- NEVER say "You can visit the property on Monday, February 2nd" - that implies walk-in. Say "You can schedule a tour for Monday, February 2nd" or "Available times to book: Monday, February 2nd (9 AM - 12 PM)".
- For scheduling/tour: If lead said "book through chat" or "in chat", skip offering the link - ask for name, email, phone only. Otherwise offer BOTH: (1) booking link from tool, (2) "Or I can book it here in chat — share your name, email, and phone."
- For get_tour_slots: 
  * Only state the exact days and times from the tool result. Use availableSlots (date/time) and schedulingInfo.availableDays. Do NOT add or assume other days.
  * When presenting times, look at the FULL RANGE of available times for EACH date in availableSlots. If slots span 9:00 AM to 12:00 PM, say "9:00 AM to 12:00 PM" or "9 AM through 12 PM", NOT just "9:00 AM to 10:00 AM".
  * CRITICAL: If availableSlots contains MULTIPLE DATES (e.g., Feb 2, Feb 9, Feb 16), present ALL of them to the user. DO NOT say "only one day available" or limit to just the first date. Group by date and show the time range for each date.
  * Example: If availableSlots has slots for 2026-02-02, 2026-02-09, and 2026-02-16, all with times 9:00-12:00, say "We have availability on Monday, February 2nd (9 AM - 12 PM), Monday, February 9th (9 AM - 12 PM), and Monday, February 16th (9 AM - 12 PM)."
- NEVER use markdown link format [text](url) - always use plain URLs so they are clickable
- NEVER say "I'm unable to provide details" or "there seems to be an issue" if the tool returned valid data (even if empty)
- If the tool returned success: true, the data is valid - use it to answer the question
- Write a natural, conversational response as if you're a helpful leasing agent
- DO NOT use placeholder text like "This is a sample answer" - write an actual helpful response based on the data
- Be friendly, professional, and helpful
- NEVER end your response with "Let me check..." or defer to a future message. Include the full answer (slots, link, or next step) in this single response.

Generate a structured response following the schema. Your answer must be grounded in the context data provided above. Write a real, helpful response - not a placeholder.`;

  console.log('[AI V2] Generating structured response...');
  
  try {
    // Set max_tokens for one-paragraph responses
    const maxTokens = personalitySettings.responseLength === 'one-paragraph' ? 200 : undefined;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_ai_response",
          strict: false, // Set to false to allow flexible data in toolResults
          schema: structuredOutputSchema
        }
      }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content');
    }

    // Generate unique request ID for logging
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Attempt to parse JSON with repair fallback
    // NOTE: JSON repair should be rare - if it happens, degrade confidence
    let parsed: any;
    let jsonRepaired = false;
    try {
      parsed = JSON.parse(content);
    } catch (parseError: any) {
      console.error(`[AI V2] ⚠️ JSON parse failed for request ${requestId} - this should be rare!`, parseError);
      console.error(`[AI V2] Raw content (first 1000 chars):`, content.substring(0, 1000));
      
      // Attempt JSON repair (safety net, but log as error)
      const { repairJsonOutput, generateSafeFallbackResponse } = await import('./aiJsonRepair');
      const repairResult = await repairJsonOutput(openai, content, requestId);
      
      if (repairResult.success && repairResult.repairedJson) {
        console.warn(`[AI V2] ⚠️ JSON repair successful for request ${requestId} - confidence will be degraded`);
        parsed = repairResult.repairedJson;
        jsonRepaired = true;
      } else {
        console.error(`[AI V2] ❌ JSON repair failed for request ${requestId}, using fallback`);
        return generateSafeFallbackResponse(repairResult.error);
      }
    }

    const validated = validateStructuredResponse(parsed);

    if (!validated) {
      throw new Error('Invalid structured response format');
    }

    // Mark if JSON was repaired (degrades confidence)
    validated.jsonRepaired = jsonRepaired;
    
    // If JSON was repaired, confidence cannot be high
    if (jsonRepaired && validated.confidence === 'high') {
      console.warn(`[AI V2] Degrading confidence from 'high' to 'medium' due to JSON repair`);
      validated.confidence = 'medium';
    }

    // Add tool results to response
    validated.toolResults = toolResults;

    // Add sources from tool results with proper typing
    toolResults.forEach((result, index) => {
      if (result.success) {
        const toolCallId = `tool_${requestId}_${index}`;
        // Generate small hash of tool parameters for audit
        const payloadHash = result.data ? 
          Buffer.from(JSON.stringify(result.data)).toString('base64').substring(0, 16) : undefined;
        
        validated.sources.push({
          type: 'tool',
          name: result.toolName,
          toolCallId: toolCallId,
          payloadHash: payloadHash,
          reference: 'function_call_result'
        });
        
        // Link toolCallId back to tool result (extend the result object)
        const resultWithId = result as typeof result & { toolCallId?: string };
        if (!resultWithId.toolCallId) {
          resultWithId.toolCallId = toolCallId;
        }
      }
    });

    // Post-process: strip delaying phrases (AI responds once — never "let me check" or similar)
    const delayingPhrases = [
      /\s*[.,]?\s*Let me check[^.]*\.?/gi,
      /\s*[.,]?\s*I'll check[^.]*\.?/gi,
      /\s*[.,]?\s*Give me a moment[^.]*\.?/gi,
      /\s*[.,]?\s*Hang tight[^.]*\.?/gi,
      /\s*[.,]?\s*One moment[^.]*\.?/gi,
      /\s*[.,]?\s*Let me look (that |this )?up[^.]*\.?/gi,
    ];
    let cleaned = validated.answer;
    for (const pat of delayingPhrases) {
      cleaned = cleaned.replace(pat, '');
    }
    cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
    if (cleaned.length >= 10) validated.answer = cleaned;

    // Post-process: replace placeholder/example.com/example booking URLs with real link from tool results
    const tourSlotsResult = toolResults.find(r => r.toolName === 'get_tour_slots');
    const realBookingLink = tourSlotsResult?.data?.bookingLink;
    if (realBookingLink) {
      validated.answer = validated.answer
        .replace(/https?:\/\/example\.com\/book-showing\/property\/[^\s)\]'"]*/gi, realBookingLink)
        .replace(/https?:\/\/example\.com\/[^\s)\]'"]*book-showing[^\s)\]'"]*/gi, realBookingLink)
        // Replace bare "example" placeholders (e.g. "this link: example", "link: example")
        .replace(/(link:\s*)example\b/gi, `$1${realBookingLink}`)
        .replace(/(this\s+link:\s*)example\b/gi, `$1${realBookingLink}`)
        .replace(/(use\s+this\s+link:\s*)example\b/gi, `$1${realBookingLink}`)
        .replace(/(visit\s+this\s+link:\s*)example\b/gi, `$1${realBookingLink}`)
        .replace(/(you\s+can\s+use\s+(?:this\s+)?link:\s*)example\b/gi, `$1${realBookingLink}`);
    }

    // Post-process: if create_tour_booking was NOT run, strip false booking claims and replace with next-step message
    const bookingWasActuallyCreated = toolResults.some(r => r.toolName === 'create_tour_booking' && r.success);
    if (!bookingWasActuallyCreated && (intent.intent === 'scheduling' || intent.intent === 'tour_booking' || intent.intent === 'availability' || intent.intent === 'contact_info')) {
      const safeNextStep = "To complete your tour booking, please reply 'yes' to confirm the time and I'll finalize it.";
      const falseClaimPatterns: Array<[RegExp, string]> = [
        [/\byour\s+tour\s+is\s+(?:successfully\s+)?booked\b/gi, safeNextStep],
        [/\bI['']?ve\s+(?:successfully\s+)?booked\s+your\s+tour\b/gi, safeNextStep],
        [/\byour\s+tour\s+is\s+now\s+booked\b/gi, safeNextStep],
        [/\btour\s+is\s+successfully\s+booked\b/gi, safeNextStep],
        [/\bI['']?m\s+pleased\s+to\s+confirm\s+your\s+tour\b/gi, safeNextStep],
      ];
      for (const [pat, replacement] of falseClaimPatterns) {
        validated.answer = validated.answer.replace(pat, replacement);
      }
    }

    // Post-process to enforce length constraints
    if (maxSentences) {
      validated.answer = enforceLengthConstraint(validated.answer, maxSentences);
    }

    // If answer ends with truncated URL (e.g. "https://www") and we have realBookingLink, append full link
    if (realBookingLink && /https?:\/\/[^\s]*$/.test(validated.answer.trim())) {
      const trimmed = validated.answer.trim();
      const urlMatch = trimmed.match(/https?:\/\/[^\s]*$/);
      if (urlMatch) {
        const partialUrl = urlMatch[0];
        // Incomplete URL: ends without valid TLD/path (e.g. "https://www" or "https://www.")
        const looksTruncated = partialUrl.length < 20 || /https?:\/\/www\.?$/i.test(partialUrl);
        if (looksTruncated) {
          validated.answer = trimmed.replace(new RegExp(partialUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), realBookingLink);
        }
      }
    }

    // Personalize if enabled and lead name available
    if (lead?.name && styleProfile?.personalizationTokensAllowed?.includes('name')) {
      // Simple personalization: replace generic greetings with lead name if not already present
      if (!validated.answer.toLowerCase().includes(lead.name.toLowerCase())) {
        // Add name to greeting if it starts with a greeting
        const namePattern = new RegExp(`^(Hi|Hello|Hey|Good morning|Good afternoon|Good evening)`, 'i');
        if (namePattern.test(validated.answer)) {
          validated.answer = validated.answer.replace(namePattern, (match) => `${match} ${lead.name}`);
        }
      }
    }

    console.log('[AI V2] Generated response:', {
      confidence: validated.confidence,
      needsHuman: validated.needsHuman,
      sourcesCount: validated.sources.length,
      answerLength: validated.answer.length,
      styleProfileUsed: !!styleProfile
    });

    // MEMORY WRITE (post-response): Update conversation memory with state machine validation
    if (leadId && !isPracticeMode && contextPack) {
      try {
        const { loadLeadMemory, saveLeadMemory } = await import('./aiConversationMemory');
        const currentMemory = await loadLeadMemory(leadId);
        
        // Ensure propertyId/unitId are included in memory update
        // Use effective values (detected, lead, or memory)
        const effectivePropertyId = detectedPropertyId || lead?.propertyId || memoryContext?.state?.propertyId || undefined;
        const effectiveUnitId = detectedUnitId || memoryContext?.state?.unitId || undefined;
        
        // Update memory with current propertyId/unitId if available
        await updateMemoryFromResponse(leadId, validated, currentMemory, toolResults, intent.intent);
        
        // Also update propertyId/unitId directly if we have them
        if (effectivePropertyId || effectiveUnitId) {
          const updatedMemory = await loadLeadMemory(leadId);
          if (updatedMemory) {
            const updatedState = {
              ...updatedMemory.stateJson,
              ...(effectivePropertyId ? { propertyId: effectivePropertyId } : {}),
              ...(effectiveUnitId ? { unitId: effectiveUnitId } : {})
            };
            await saveLeadMemory(leadId, updatedMemory.summaryText, updatedState);
            console.log('[AI V2] Updated conversation memory with propertyId/unitId:', { 
              propertyId: effectivePropertyId, 
              unitId: effectiveUnitId 
            });
          }
        }
        
        console.log('[AI V2] Updated conversation memory with validated state transition');
      } catch (error) {
        console.error('[AI V2] Error updating conversation memory:', error);
        // Don't fail the request if memory update fails
      }
    }

    return validated;
  } catch (error: any) {
    console.error('[AI V2] Error generating response:', error);
    
    // Fallback: never expose technical failures to the lead
    return {
      answer: "Thanks for reaching out! Our team will follow up with you shortly.",
      sources: [],
      confidence: 'low',
      needsHuman: true,
      toolResults: toolResults
    };
  }
}

