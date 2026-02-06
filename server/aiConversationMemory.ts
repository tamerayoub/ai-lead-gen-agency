import { storage } from "./storage";
import { StructuredAIResponse } from "./aiStructuredOutput";
import { pool } from "./db";

/**
 * Conversation Memory Layer for AI Leasing Agent V2
 * 
 * Manages rolling conversation summaries and state per lead to enable context-aware responses.
 * Memory is read BEFORE routing and updated AFTER response generation.
 */

/**
 * Allowed flow types (state machine)
 */
export type FlowType = 'availability' | 'scheduling' | 'tour_booking' | 'qualifications' | 'pricing' | 'application_status' | 'portfolio_units' | 'faq_policy' | 'neighborhood' | null;

/**
 * Tour booking sub-state (stored in stateJson.booking)
 */
export interface TourBookingState {
  propertyId?: string;
  unitId?: string;
  slotId?: string; // e.g. "2026-02-02_14:00"
  missingFields?: Array<'name' | 'email' | 'phone' | 'slotId' | 'propertyId' | 'unitId'>;
  pendingConfirmation?: boolean;
  lastOfferedSlots?: { slotIds: string[]; shownAt: string }; // ISO timestamp
  schedulingMode?: 'link' | 'in_chat';
}

/**
 * Question types for lastAiQuestion
 */
export type QuestionType = 'property_select' | 'unit_select' | 'date_time_select' | 'move_in_date' | 'income' | 'pets' | 'other';

/**
 * Known fields per flow type
 */
export const FLOW_REQUIRED_FIELDS: Record<NonNullable<FlowType>, string[]> = {
  availability: ['propertyId'],
  scheduling: ['propertyId', 'unitId'],
  tour_booking: ['propertyId', 'name', 'email', 'phone', 'slotId'], // unitId optional
  qualifications: ['propertyId'],
  pricing: ['unitId'],
  application_status: ['leadId'],
  portfolio_units: [],
  faq_policy: [],
  neighborhood: ['propertyId'],
};

export interface ConversationMemory {
  leadId: string;
  summaryText: string;
  stateJson: {
    currentFlow?: FlowType;
    lastAiQuestion?: string | null;
    lastAiQuestionType?: QuestionType | null;
    propertyId?: string | null;
    unitId?: string | null;
    missingFields?: string[]; // Must be subset of FLOW_REQUIRED_FIELDS[currentFlow]
    lastIntent?: string | null;
    lastToolResults?: Record<string, any>; // Lightweight (IDs only, no big payloads)
    schedulingMode?: 'link' | 'in_chat';
    booking?: TourBookingState;
    leadContact?: { hasName: boolean; hasEmail: boolean; hasPhone: boolean };
  };
  updatedAt: Date;
}

/**
 * Validate state transition
 */
export function validateStateTransition(
  currentState: ConversationMemory['stateJson'],
  newState: ConversationMemory['stateJson']
): { valid: boolean; error?: string } {
  const newFlow = newState.currentFlow;
  
  // If flow changed, validate missingFields match new flow
  if (newFlow && newFlow !== currentState.currentFlow) {
    const allowedFields = FLOW_REQUIRED_FIELDS[newFlow] || [];
    if (newState.missingFields) {
      const invalidFields = newState.missingFields.filter(f => !allowedFields.includes(f));
      if (invalidFields.length > 0) {
        return {
          valid: false,
          error: `Invalid missingFields for flow ${newFlow}: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`
        };
      }
    }
  }
  
  // Validate missingFields are known fields for current flow
  if (newFlow && newState.missingFields) {
    const allowedFields = FLOW_REQUIRED_FIELDS[newFlow] || [];
    const invalidFields = newState.missingFields.filter(f => !allowedFields.includes(f));
    if (invalidFields.length > 0) {
      return {
        valid: false,
        error: `Invalid missingFields: ${invalidFields.join(', ')}. Allowed for flow ${newFlow}: ${allowedFields.join(', ')}`
      };
    }
  }
  
  return { valid: true };
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationContextPack {
  summary: string;
  state: ConversationMemory['stateJson'];
  recentTurns: ConversationTurn[];
}

/**
 * Load conversation memory for a lead
 */
export async function loadLeadMemory(leadId: string): Promise<ConversationMemory | null> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT lead_id, summary_text, state_json, updated_at, created_at
        FROM lead_ai_memory
        WHERE lead_id = $1
      `, [leadId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        leadId: row.lead_id,
        summaryText: row.summary_text || '',
        stateJson: typeof row.state_json === 'string' ? JSON.parse(row.state_json) : (row.state_json || {}),
        updatedAt: new Date(row.updated_at)
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Conversation Memory] Error loading memory:', error);
    return null;
  }
}

/**
 * Create or update conversation memory
 */
export async function saveLeadMemory(
  leadId: string,
  summaryText: string,
  stateJson: ConversationMemory['stateJson']
): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO lead_ai_memory (lead_id, summary_text, state_json, updated_at)
        VALUES ($1, $2, $3::jsonb, now())
        ON CONFLICT (lead_id)
        DO UPDATE SET
          summary_text = EXCLUDED.summary_text,
          state_json = EXCLUDED.state_json,
          updated_at = now()
      `, [leadId, summaryText, JSON.stringify(stateJson)]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Conversation Memory] Error saving memory:', error);
    throw error;
  }
}

/**
 * Load recent conversation turns for a lead
 */
export async function loadRecentTurns(
  leadId: string,
  orgId: string,
  limit: number = 10
): Promise<ConversationTurn[]> {
  try {
    const conversations = await storage.getConversationsByLeadId(leadId, orgId);
    
    // Sort by date (most recent first) and take last N
    const sorted = conversations
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit);

    return sorted.map(conv => {
      // Strip HTML and cap length
      let content = conv.message || '';
      // Remove HTML tags
      content = content.replace(/<[^>]*>/g, '');
      // Cap at 500 chars per message
      if (content.length > 500) {
        content = content.substring(0, 500) + '...';
      }

      return {
        role: (conv.type === 'incoming' || conv.type === 'received') ? 'user' : 'assistant',
        content: content.trim(),
        timestamp: new Date(conv.createdAt)
      };
    });
  } catch (error) {
    console.error('[Conversation Memory] Error loading recent turns:', error);
    return [];
  }
}

/**
 * Build conversation context pack for prompt injection
 */
export async function buildContextPack(
  leadId: string,
  orgId: string
): Promise<ConversationContextPack> {
  // Load memory (create default if missing)
  let memory = await loadLeadMemory(leadId);
  if (!memory) {
    memory = {
      leadId,
      summaryText: '',
      stateJson: {},
      updatedAt: new Date()
    };
    // Create default row
    await saveLeadMemory(leadId, '', {});
  }

  // Load recent turns
  const recentTurns = await loadRecentTurns(leadId, orgId, 10);

  return {
    summary: memory.summaryText,
    state: memory.stateJson,
    recentTurns
  };
}

/**
 * Check if user message appears to answer the last AI question
 */
export function appearsToAnswerQuestion(
  userMessage: string,
  lastAiQuestion: string | null | undefined
): boolean {
  if (!lastAiQuestion) return false;

  const lowerMessage = userMessage.toLowerCase();

  // If user explicitly requests a NEW action (tour booking), do NOT treat as answering previous question.
  // "Help me book a tour with X" contains a property name but is a tour request, not answering "which property?"
  const explicitNewRequestPhrases = /\b(help\s+me\s+book|book\s+a\s+tour|schedule\s+a\s+tour|book\s+a\s+showing|i\s+want\s+to\s+book|can\s+you\s+book|please\s+book)\b/i;
  if (explicitNewRequestPhrases.test(lowerMessage)) return false;
  const lowerQuestion = lastAiQuestion.toLowerCase();

  // Check if question asks about property/address
  if (lowerQuestion.includes('which property') || 
      lowerQuestion.includes('what property') ||
      lowerQuestion.includes('which address')) {
    // Look for property indicators: addresses, property names, unit numbers
    const propertyPatterns = [
      /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard)/i,
      /unit\s+\d+/i,
      /apartment\s+\d+/i,
      /#\d+/i
    ];
    return propertyPatterns.some(pattern => pattern.test(lowerMessage));
  }

  // Check if question asks about date/time
  if (lowerQuestion.includes('date') || 
      lowerQuestion.includes('time') ||
      lowerQuestion.includes('when') ||
      lowerQuestion.includes('schedule')) {
    // Look for date/time patterns
    const dateTimePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/, // MM/DD/YYYY
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{1,2}:\d{2}\s*(am|pm)/i, // time
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(january|february|march|april|may|june|july|august|september|october|november|december)/i
    ];
    return dateTimePatterns.some(pattern => pattern.test(lowerMessage));
  }

  // Check if question asks for name/email/phone (tour booking flow)
  if (lowerQuestion.includes('name') || lowerQuestion.includes('email') || lowerQuestion.includes('phone') ||
      lowerQuestion.includes('contact')) {
    // Email pattern
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(lowerMessage)) return true;
    // Phone pattern
    if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/.test(lowerMessage)) return true;
    // Name pattern (2+ words or single capitalized word)
    if (/\b[a-z][a-z'-]+\s+[a-z][a-z'-]+/i.test(lowerMessage) || /^[A-Z][a-z]+$/.test(lowerMessage.trim())) return true;
    // Combined "John Doe, j@e.com, 555-1234" style
    if (lowerMessage.includes('@') || /\d{7,}/.test(lowerMessage.replace(/\D/g, ''))) return true;
  }

  // Check if question asks for slot selection ("Reply 1/2/3", "pick 1", "number (1-4)", "Reply with the number (1-4)")
  const asksForSlotNumber = lowerQuestion.includes('slot') ||
    (lowerQuestion.includes('which') && (lowerQuestion.includes('time') || lowerQuestion.includes('option'))) ||
    (lowerQuestion.includes('number') && /\(?1-4\)?|1\s*[-–]\s*4/.test(lowerQuestion)) ||
    (lowerQuestion.includes('reply') && (lowerQuestion.includes('1') || lowerQuestion.includes('number')));
  if (asksForSlotNumber) {
    if (/^[1-4]\s*$|^option\s*[1-4]\s*$|^#?[1-4]\s*$/i.test(lowerMessage.trim())) return true;
    if (/^[1-4][.)\s\-]/.test(lowerMessage.trim())) return true; // "3. 2026-02-02 at 09:15", "3)", "3 -"
    if (/\d{4}-\d{2}-\d{2}\s+at\s+\d{1,2}:\d{2}/.test(lowerMessage)) return true; // "2026-02-02 at 09:15"
    if (/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(:\d{2})?\s*(am|pm)?/i.test(lowerMessage)) return true;
    if (/\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}\s*(am|pm)/i.test(lowerMessage)) return true;
  }

  // Check if question asks yes/no
  if (lowerQuestion.includes('?') && (
      lowerMessage.startsWith('yes') ||
      lowerMessage.startsWith('no') ||
      lowerMessage.startsWith('sure') ||
      lowerMessage.startsWith('ok') ||
      lowerMessage.startsWith('yeah') ||
      lowerMessage.startsWith('confirm')
    )) {
    return true;
  }

  return false;
}

/**
 * Map tool name to flow type
 */
function toolNameToFlowType(toolName: string): FlowType {
  const mapping: Record<string, FlowType> = {
    'get_tour_slots': 'scheduling',
    'quote_price': 'pricing',
    'get_availability': 'availability',
    'list_portfolio_units': 'portfolio_units',
    'get_qualifications': 'qualifications',
    'get_application_status': 'application_status',
    'get_nearby_places_openai': 'neighborhood',
    'upsert_lead_contact': 'tour_booking',
    'create_tour_booking': 'tour_booking',
  };
  return mapping[toolName] || null;
}

/**
 * Determine question type from question text
 */
function determineQuestionType(question: string | null): QuestionType | null {
  if (!question) return null;
  const lower = question.toLowerCase();
  if (lower.includes('property') || lower.includes('address') || lower.includes('which property')) {
    return 'property_select';
  }
  if (lower.includes('unit') || lower.includes('apartment') || lower.includes('which unit')) {
    return 'unit_select';
  }
  if (lower.includes('date') || lower.includes('time') || lower.includes('when') || lower.includes('schedule')) {
    return 'date_time_select';
  }
  if (lower.includes('move-in') || lower.includes('move in')) {
    return 'move_in_date';
  }
  if (lower.includes('income') || lower.includes('salary') || lower.includes('earn')) {
    return 'income';
  }
  if (lower.includes('pet')) {
    return 'pets';
  }
  return 'other';
}

/**
 * Update memory from structured response with state machine validation
 * @param stateOverrides - Optional overrides for booking/leadContact (set by reply generator for tour_booking flow)
 */
export async function updateMemoryFromResponse(
  leadId: string,
  structuredResponse: StructuredAIResponse,
  currentMemory: ConversationMemory | null,
  toolResults?: Array<{ toolName: string; success: boolean; data?: any }>,
  intent?: string,
  stateOverrides?: Partial<ConversationMemory['stateJson']>
): Promise<void> {
  // Build new state
  const newState: ConversationMemory['stateJson'] = {
    ...(currentMemory?.stateJson || {}),
    lastIntent: intent || structuredResponse.sources.find(s => s.type === 'tool')?.name || 
                structuredResponse.sources.find(s => s.type === 'rag')?.name || 
                'unknown',
    lastAiQuestion: structuredResponse.followUpQuestion || null,
    lastAiQuestionType: determineQuestionType(structuredResponse.followUpQuestion || null),
    lastToolResults: toolResults?.map(tr => ({
      toolName: tr.toolName,
      success: tr.success,
      // Only store IDs, not full payloads
      dataKeys: tr.data ? Object.keys(tr.data) : []
    }))
  };

  // Determine current flow from intent or tool
  if (intent) {
    // Map intent to flow type
    const intentToFlow: Record<string, FlowType> = {
      'availability': 'availability',
      'pricing': 'pricing',
      'scheduling': 'scheduling',
      'tour_booking': 'tour_booking',
      'qualifications': 'qualifications',
      'portfolio_units': 'portfolio_units',
      'application_status': 'application_status',
      'faq_policy': 'faq_policy',
      'neighborhood': 'neighborhood',
    };
    newState.currentFlow = intentToFlow[intent] || null;
  } else {
    // Fallback to tool name
    const intentSource = structuredResponse.sources.find(s => s.type === 'tool');
    if (intentSource) {
      newState.currentFlow = toolNameToFlowType(intentSource.name);
    }
  }
  
  // Calculate missing fields based on current flow
  if (newState.currentFlow) {
    const requiredFields = FLOW_REQUIRED_FIELDS[newState.currentFlow] || [];
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (field === 'propertyId' && !newState.propertyId) {
        missingFields.push('propertyId');
      } else if (field === 'unitId' && !newState.unitId && requiredFields.includes('unitId')) {
        missingFields.push('unitId');
      } else if (field === 'leadId' && !leadId) {
        missingFields.push('leadId');
      }
      // tour_booking: name, email, phone, slotId - handled via stateOverrides/leadContact/booking
    }
    
    newState.missingFields = missingFields.length > 0 ? missingFields : undefined;
  }

  // Apply state overrides (from reply generator for tour_booking flow)
  if (stateOverrides) {
    if (stateOverrides.booking !== undefined) newState.booking = stateOverrides.booking;
    if (stateOverrides.leadContact !== undefined) newState.leadContact = stateOverrides.leadContact;
    if (stateOverrides.schedulingMode !== undefined) newState.schedulingMode = stateOverrides.schedulingMode;
    if (stateOverrides.missingFields !== undefined) newState.missingFields = stateOverrides.missingFields;
    if (stateOverrides.currentFlow !== undefined) newState.currentFlow = stateOverrides.currentFlow as FlowType | null;
  }

  // Update from tool results: upsert_lead_contact, create_tour_booking
  if (toolResults) {
    for (const tr of toolResults) {
      if (!tr.success || !tr.data) continue;
      if (tr.toolName === 'upsert_lead_contact' && tr.data) {
        newState.leadContact = {
          hasName: !!tr.data.name,
          hasEmail: !!tr.data.email,
          hasPhone: !!tr.data.phone,
        };
      }
      if (tr.toolName === 'create_tour_booking' && tr.data?.bookingId) {
        // Booking succeeded - clear booking flow state
        newState.booking = undefined;
        newState.currentFlow = null;
        newState.schedulingMode = undefined;
      }
    }
  }

  // Extract propertyId/unitId from tool results if available
  // Also preserve existing propertyId/unitId from memory if not overwritten
  if (toolResults) {
    for (const tr of toolResults) {
      if (tr.success && tr.data) {
        if (tr.data.propertyId) {
          newState.propertyId = tr.data.propertyId;
          console.log(`[Conversation Memory] Setting propertyId from tool result: ${tr.data.propertyId}`);
        }
        if (tr.data.unitId) {
          newState.unitId = tr.data.unitId;
          console.log(`[Conversation Memory] Setting unitId from tool result: ${tr.data.unitId}`);
        }
        if (tr.data.properties && Array.isArray(tr.data.properties) && tr.data.properties.length > 0) {
          // If multiple properties, don't set a single propertyId
          if (tr.data.properties.length === 1) {
            newState.propertyId = tr.data.properties[0].propertyId;
            console.log(`[Conversation Memory] Setting propertyId from single property in list: ${newState.propertyId}`);
          }
        }
        // Also check units array for propertyId
        if (tr.data.units && Array.isArray(tr.data.units) && tr.data.units.length > 0) {
          // If all units are from the same property, set propertyId
          const firstUnit = tr.data.units[0];
          if (firstUnit.propertyId && tr.data.units.every((u: any) => u.propertyId === firstUnit.propertyId)) {
            newState.propertyId = firstUnit.propertyId;
            console.log(`[Conversation Memory] Setting propertyId from units array: ${newState.propertyId}`);
          }
        }
      }
    }
  }
  
  // Preserve existing propertyId/unitId from memory if not set by tool results
  if (!newState.propertyId && currentMemory?.stateJson?.propertyId) {
    newState.propertyId = currentMemory.stateJson.propertyId;
    console.log(`[Conversation Memory] Preserving propertyId from previous memory: ${newState.propertyId}`);
  }
  if (!newState.unitId && currentMemory?.stateJson?.unitId) {
    newState.unitId = currentMemory.stateJson.unitId;
    console.log(`[Conversation Memory] Preserving unitId from previous memory: ${newState.unitId}`);
  }

  // Update missing fields based on follow-up question
  if (structuredResponse.followUpQuestion) {
    const question = structuredResponse.followUpQuestion.toLowerCase();
    newState.missingFields = [];
    if (question.includes('property')) {
      newState.missingFields.push('propertyId');
    }
    if (question.includes('date') || question.includes('move-in')) {
      newState.missingFields.push('moveInDate');
    }
    if (question.includes('time') || question.includes('schedule')) {
      newState.missingFields.push('preferredTime');
    }
  } else {
    newState.missingFields = [];
  }

  // Build summary (keep <= 800 chars)
  let summary = currentMemory?.summaryText || '';
  
  // Add key info from response
  const keyInfo: string[] = [];
  if (newState.propertyId) {
    keyInfo.push(`Property: ${newState.propertyId}`);
  }
  if (newState.unitId) {
    keyInfo.push(`Unit: ${newState.unitId}`);
  }
  if (newState.currentFlow) {
    keyInfo.push(`Flow: ${newState.currentFlow}`);
  }
  if (newState.missingFields && newState.missingFields.length > 0) {
    keyInfo.push(`Missing: ${newState.missingFields.join(', ')}`);
  }

  // Update summary (simple append, truncate if too long)
  if (keyInfo.length > 0) {
    const newInfo = keyInfo.join('. ') + '. ';
    summary = (summary + ' ' + newInfo).trim();
    // Truncate to 800 chars
    if (summary.length > 800) {
      summary = summary.substring(summary.length - 800);
    }
  }

  // Save updated memory
  await saveLeadMemory(leadId, summary, newState);
}

