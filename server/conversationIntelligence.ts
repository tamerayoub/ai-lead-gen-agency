/**
 * Conversation Intelligence & Context Awareness
 * 
 * Analyzes conversation history to:
 * - Detect lead intent
 * - Identify already answered questions
 * - Detect unresponsive leads
 * - Identify complex edge cases requiring human escalation
 */

import OpenAI from "openai";

export interface ConversationAnalysis {
  leadIntent: "tour_request" | "pricing" | "qualification" | "general" | "application" | "other";
  answeredQuestions: string[]; // List of topics/questions that have been answered
  unresponsive: boolean; // True if lead hasn't responded in a while
  requiresEscalation: boolean; // True if complex case requiring human review
  escalationReason?: string; // Reason for escalation
  conversationSummary: string; // Brief summary of conversation so far
}

export interface ConversationMessage {
  type: string; // 'incoming' | 'received' | 'outgoing' | 'sent'
  message: string;
  createdAt: string;
  channel?: string;
}

/**
 * Analyze conversation history to extract intelligence
 */
export async function analyzeConversation(
  conversations: ConversationMessage[],
  openai: OpenAI
): Promise<ConversationAnalysis> {
  try {
    // Sort conversations by date
    const sortedConversations = [...conversations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Get the last outgoing message time to check for responsiveness
    const outgoingMessages = sortedConversations.filter(
      (c) => c.type === "outgoing" || c.type === "sent"
    );
    const lastOutgoingTime = outgoingMessages.length > 0
      ? new Date(outgoingMessages[outgoingMessages.length - 1].createdAt)
      : null;

    // Check if lead is unresponsive (no response in 48 hours after our last message)
    const now = new Date();
    const hoursSinceLastOutgoing = lastOutgoingTime
      ? (now.getTime() - lastOutgoingTime.getTime()) / (1000 * 60 * 60)
      : 0;
    const unresponsive = lastOutgoingTime && hoursSinceLastOutgoing > 48;

    // Build conversation context for AI analysis
    const conversationText = sortedConversations
      .map((c) => {
        const direction = c.type === "incoming" || c.type === "received" ? "Lead" : "Agent";
        const timestamp = new Date(c.createdAt).toISOString();
        return `[${timestamp}] ${direction}: ${c.message.substring(0, 500)}`;
      })
      .join("\n\n");

    // Use AI to analyze conversation
    const analysisPrompt = `Analyze this rental conversation history and provide insights.

Conversation History:
${conversationText}

Analyze and respond with a JSON object:
{
  "leadIntent": "tour_request" | "pricing" | "qualification" | "general" | "application" | "other",
  "answeredQuestions": ["array of topics/questions that have already been answered in previous messages"],
  "requiresEscalation": true/false,
  "escalationReason": "reason for escalation if requiresEscalation is true, or null",
  "conversationSummary": "Brief 2-3 sentence summary of what has been discussed so far"
}

Lead Intent categories:
- "tour_request": Lead wants to schedule a viewing/tour
- "pricing": Lead is asking about rent, fees, deposits
- "qualification": Lead is asking about requirements, application process
- "general": General questions about property, amenities, location
- "application": Lead wants to apply or has application questions
- "other": Doesn't fit other categories

Escalation should be true if:
- Complex legal or policy questions
- Complaints or disputes
- Requests that require human judgment
- Multiple failed attempts to answer the same question
- Confusing or contradictory information from lead

answeredQuestions should include topics like:
- "rent amount", "pricing", "deposit"
- "availability", "viewing times", "tours"
- "qualification requirements", "application process"
- "property amenities", "location details"
- "pet policy", "move-in dates"

Respond with ONLY the JSON object, no additional text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      leadIntent: result.leadIntent || "general",
      answeredQuestions: result.answeredQuestions || [],
      unresponsive,
      requiresEscalation: result.requiresEscalation || false,
      escalationReason: result.escalationReason || undefined,
      conversationSummary: result.conversationSummary || "New conversation",
    };
  } catch (error) {
    console.error("[Conversation Intelligence] Error analyzing conversation:", error);
    // Return safe defaults on error
    return {
      leadIntent: "general",
      answeredQuestions: [],
      unresponsive: false,
      requiresEscalation: false,
      conversationSummary: "Error analyzing conversation",
    };
  }
}

/**
 * Build conversation context for AI prompt
 */
export function buildConversationContext(
  conversations: ConversationMessage[],
  analysis: ConversationAnalysis
): string {
  // Sort conversations by date
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let context = `\n\nCONVERSATION HISTORY (for context - DO NOT repeat information already provided):\n`;
  context += `Conversation Summary: ${analysis.conversationSummary}\n`;
  context += `Lead Intent: ${analysis.leadIntent}\n`;
  
  if (analysis.answeredQuestions.length > 0) {
    context += `\nAlready Answered Topics (DO NOT repeat this information):\n`;
    analysis.answeredQuestions.forEach((topic) => {
      context += `- ${topic}\n`;
    });
  }

  context += `\nRecent Conversation Thread:\n`;
  // Include last 10 messages for context
  sortedConversations.slice(-10).forEach((c, idx) => {
    const direction = c.type === "incoming" || c.type === "received" ? "Lead" : "You (Agent)";
    const timestamp = new Date(c.createdAt).toLocaleString();
    context += `${idx + 1}. [${timestamp}] ${direction}: ${c.message.substring(0, 300)}\n`;
  });

  return context;
}

/**
 * Build instructions to avoid repetition
 */
export function buildAntiRepetitionInstructions(analysis: ConversationAnalysis): string {
  let instructions = "\n\nCRITICAL: CONVERSATION INTELLIGENCE RULES:\n";
  
  if (analysis.answeredQuestions.length > 0) {
    instructions += `- DO NOT repeat information about: ${analysis.answeredQuestions.join(", ")}\n`;
    instructions += `- Reference previous answers instead: "As I mentioned earlier..." or "To recap..."\n`;
    instructions += `- Only provide NEW information or clarify if the lead asks for clarification\n`;
  }

  instructions += `- Do not ask questions that have already been answered\n`;
  instructions += `- Build on the existing conversation - acknowledge what was discussed before\n`;
  instructions += `- If the lead is asking the same question again, politely reference the previous answer and offer to clarify\n`;

  if (analysis.unresponsive) {
    instructions += `- NOTE: Lead has been unresponsive for 48+ hours - consider a gentle follow-up\n`;
  }

  if (analysis.requiresEscalation) {
    instructions += `- ⚠️ ESCALATION REQUIRED: ${analysis.escalationReason || "Complex case requiring human review"}\n`;
    instructions += `- Suggest that a team member will reach out directly\n`;
  }

  return instructions;
}


