/**
 * Structured Output Schema for AI Leasing Agent
 * Ensures consistent, verifiable responses with citations and confidence levels
 */

/**
 * Lane-aware source types with typed citations
 * Prevents memory from being cited as authoritative
 */
export type SourceType = 'tool' | 'rag' | 'memory' | 'system' | 'database' | 'policy';

export interface ToolSource {
  type: 'tool';
  name: string; // Tool name (e.g., 'get_availability')
  toolCallId?: string; // Unique ID for this tool call
  payloadHash?: string; // Small hash of tool parameters for audit
  reference?: string; // Additional reference info
  provider?: string; // e.g., 'openai_web_search' for web-backed tools
  url?: string; // Web citation URL
  title?: string; // Web citation title
  retrievedAt?: string; // ISO timestamp when data was retrieved
}

export interface RAGSource {
  type: 'rag';
  name: string; // Document name
  docId?: string; // Document ID
  chunkId?: string; // Chunk ID within document
  version?: string; // Document version
  effectiveDate?: string; // When this document was effective
  reference?: string;
}

export interface MemorySource {
  type: 'memory';
  name: string; // e.g., 'conversation_summary'
  reference?: string; // What part of memory (e.g., 'last_intent', 'current_flow')
}

export interface SystemSource {
  type: 'system';
  name: string; // e.g., 'personality_settings', 'style_profile'
  reference?: string;
}

export interface DatabaseSource {
  type: 'database';
  name: string; // e.g., 'qualification_settings'
  reference?: string;
}

export interface PolicySource {
  type: 'policy';
  name: string; // Policy name
  version?: string; // Policy version
  effectiveDate?: string; // When policy is effective
  propertyId?: string; // Property-specific policy
  reference?: string;
}

export type Source = ToolSource | RAGSource | MemorySource | SystemSource | DatabaseSource | PolicySource;

export interface StructuredAIResponse {
  answer: string;
  sources: Source[];
  confidence: 'high' | 'medium' | 'low';
  needsHuman: boolean;
  followUpQuestion?: string;
  toolResults?: Array<{
    toolName: string;
    success: boolean;
    data?: any;
    error?: string;
    toolCallId?: string; // Link to source
  }>;
  jsonRepaired?: boolean; // True if JSON repair was used (degrades confidence)
  /** Optional action for tour booking flow tracking */
  action?: {
    type: 'offer_booking_options' | 'collect_contact' | 'confirm_booking' | 'booking_created' | 'none';
    bookingId?: string;
    slotId?: string;
  };
}

export const structuredOutputSchema = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The natural language response to the lead's question. Must be grounded in the sources provided. If you don't have authoritative information, say so clearly."
    },
    sources: {
      type: "array",
      description: "List of sources used to generate this answer. Every factual claim must have a source.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["tool", "rag", "memory", "system", "database", "policy"],
            description: "Type of source: 'tool' for function call results, 'rag' for retrieved documents, 'memory' for conversation memory (not authoritative), 'system' for system settings, 'database' for direct DB queries, 'policy' for policy documents"
          },
          name: {
            type: "string",
            description: "Name of the source (e.g., 'get_availability', 'pet_policy_doc', 'qualification_settings')"
          },
          toolCallId: {
            type: "string",
            description: "For tool sources: unique ID for this tool call"
          },
          payloadHash: {
            type: "string",
            description: "For tool sources: small hash of tool parameters for audit"
          },
          docId: {
            type: "string",
            description: "For RAG sources: document ID"
          },
          chunkId: {
            type: "string",
            description: "For RAG sources: chunk ID within document"
          },
          version: {
            type: "string",
            description: "For RAG/policy sources: version number"
          },
          effectiveDate: {
            type: "string",
            description: "For RAG/policy sources: when this document/policy was effective"
          },
          propertyId: {
            type: "string",
            description: "For policy sources: property-specific policy ID"
          },
          reference: {
            type: "string",
            description: "Optional reference (e.g., tool result ID, document section, policy version, memory field name)"
          },
          provider: {
            type: "string",
            description: "For tool sources with web data: provider name (e.g., 'openai_web_search')"
          },
          url: {
            type: "string",
            description: "For web-backed tools: citation URL"
          },
          title: {
            type: "string",
            description: "For web-backed tools: citation page title"
          },
          retrievedAt: {
            type: "string",
            description: "For web-backed tools: ISO timestamp when data was retrieved"
          }
        },
        required: ["type", "name"],
        additionalProperties: false
      }
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence level: 'high' if answer is fully grounded in authoritative sources, 'medium' if mostly grounded but some inference, 'low' if uncertain or missing key information"
    },
    needsHuman: {
      type: "boolean",
      description: "True if this conversation should be escalated to a human agent (complex legal questions, complaints, application denials, etc.)"
    },
    followUpQuestion: {
      type: "string",
      description: "Optional targeted follow-up question to clarify the lead's intent if needed"
    },
    action: {
      type: "object",
      description: "Optional action for tour booking flow: offer_booking_options, collect_contact, confirm_booking, booking_created, none",
      properties: {
        type: { type: "string", enum: ["offer_booking_options", "collect_contact", "confirm_booking", "booking_created", "none"] },
        bookingId: { type: "string" },
        slotId: { type: "string" },
      },
    },
    toolResults: {
      type: "array",
      description: "Results from function calls made during this response",
      items: {
        type: "object",
        properties: {
          toolName: { type: "string" },
          success: { type: "boolean" },
          data: { 
            type: "object"
          },
          error: { type: "string" }
        },
        required: ["toolName", "success"],
        additionalProperties: false
      }
    }
  },
  required: ["answer", "sources", "confidence", "needsHuman"],
  additionalProperties: false
} as const;

/**
 * Guardrails and validation for structured responses
 */
export function validateStructuredResponse(response: any): StructuredAIResponse | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  // Ensure required fields
  if (!response.answer || typeof response.answer !== 'string') {
    return null;
  }

  if (!Array.isArray(response.sources)) {
    response.sources = [];
  }

  if (!['high', 'medium', 'low'].includes(response.confidence)) {
    response.confidence = 'low';
  }

  if (typeof response.needsHuman !== 'boolean') {
    response.needsHuman = false;
  }

  // Validate sources with lane-aware types
  response.sources = response.sources.filter((source: any) => {
    if (!source || typeof source !== 'object' || typeof source.name !== 'string') {
      return false;
    }
    const validTypes = ['tool', 'rag', 'memory', 'system', 'database', 'policy'];
    if (!validTypes.includes(source.type)) {
      return false;
    }
    // Type-specific validation
    if (source.type === 'tool' && source.toolCallId) {
      // Tool sources should have toolCallId if available
    }
    if (source.type === 'rag' && (source.docId || source.version)) {
      // RAG sources should have docId or version
    }
    if (source.type === 'policy' && (source.version || source.effectiveDate)) {
      // Policy sources should have version or effectiveDate
    }
    return true;
  });

  return response as StructuredAIResponse;
}

/**
 * Generate guardrail instructions for system prompt
 */
export function getGuardrailInstructions(): string {
  return `CRITICAL ACCURACY RULES (you MUST follow these):

1. GROUNDED ANSWERS ONLY:
   - If you don't have supporting source text or live data from tools, say "I don't have that information available right now" or "Let me check that for you"
   - NEVER make up prices, availability, policies, or any factual information
   - When quoting fees/prices/availability, these MUST come from tool results or retrieved documents

2. SOURCE REQUIREMENTS:
   - Every factual claim in your answer must have a corresponding source in the sources array
   - If you're inferring or making assumptions, set confidence to "medium" or "low"
   - Only set confidence to "high" if the answer is directly supported by authoritative sources

3. ESCALATION RULES (set needsHuman=true for):
   - Legal questions about fair housing, discrimination, tenant rights
   - Credit denial specifics or screening rejections
   - Complaints or negative feedback
   - Complex situations requiring judgment
   - Application status inquiries (if not authenticated)

4. POLICY HIERARCHY (when multiple sources conflict):
   - Company policy > property policy > unit exceptions > agent override notes
   - Always use the most specific applicable policy

5. TOOL USAGE:
   - For availability questions → MUST call get_availability tool
   - For pricing questions → MUST call quote_price tool
   - For scheduling questions → MUST call get_tour_slots tool
   - For application status → MUST call get_application_status tool (if authenticated)
   - For neighborhood/nearby questions → MUST call get_nearby_places_openai tool (property required)
   - Never answer availability/pricing/scheduling/neighborhood questions without calling the appropriate tool first

6. NEIGHBORHOOD GUARDRAILS:
   - Do NOT claim or infer crime/safety statistics
   - Do NOT infer demographics
   - If user asks "is it safe?" → set needsHuman=true and suggest official/local sources

7. UNCERTAINTY HANDLING:
   - If tool calls fail or return no data, say so clearly
   - If confidence is low, offer to connect with a human agent
   - Never guess or infer when you should be using tools`;
}

