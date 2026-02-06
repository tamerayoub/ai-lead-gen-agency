import OpenAI from "openai";
import { structuredOutputSchema } from "./aiStructuredOutput";

/**
 * JSON Repair Pipeline for Structured Output Failures
 * 
 * Handles cases where OpenAI returns malformed JSON by:
 * 1. Attempting to repair the JSON
 * 2. Falling back to safe response if repair fails
 */

export interface RepairResult {
  success: boolean;
  repairedJson?: any;
  error?: string;
}

/**
 * Attempt to repair malformed JSON from model output
 */
export async function repairJsonOutput(
  openai: OpenAI,
  rawOutput: string,
  requestId: string
): Promise<RepairResult> {
  console.log(`[JSON Repair] Attempting to repair JSON for request ${requestId}`);
  console.log(`[JSON Repair] Raw output (first 500 chars):`, rawOutput.substring(0, 500));

  try {
    // First, try to extract JSON from the output (might be wrapped in markdown or prose)
    let jsonCandidate = rawOutput.trim();
    
    // Remove markdown code blocks
    jsonCandidate = jsonCandidate.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    
    // Try to find JSON object boundaries
    const jsonStart = jsonCandidate.indexOf('{');
    const jsonEnd = jsonCandidate.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonCandidate = jsonCandidate.substring(jsonStart, jsonEnd + 1);
    }

    // Try parsing first
    try {
      const parsed = JSON.parse(jsonCandidate);
      return { success: true, repairedJson: parsed };
    } catch (e) {
      // If direct parse fails, try repair with LLM
      console.log('[JSON Repair] Direct parse failed, attempting LLM repair...');
    }

    // Use LLM to repair JSON
    const repairPrompt = `The following text was supposed to be valid JSON matching this schema, but it's malformed. 
Extract and repair it to be valid JSON. Output ONLY the JSON object, nothing else.

IMPORTANT: The "answer" field must contain a real, helpful response to the lead's question - NOT placeholder text like "This is a sample answer". Write an actual conversational response based on the data provided.

Schema:
${JSON.stringify(structuredOutputSchema, null, 2)}

Malformed JSON:
${jsonCandidate.substring(0, 2000)}

Return ONLY valid JSON matching the schema. The "answer" field must be a real response, not a placeholder.`;

    const repairResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: repairPrompt
      }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const repairedContent = repairResponse.choices[0].message.content;
    if (!repairedContent) {
      throw new Error('No content in repair response');
    }

    // Clean and parse repaired JSON
    let cleaned = repairedContent.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    
    const jsonStart2 = cleaned.indexOf('{');
    const jsonEnd2 = cleaned.lastIndexOf('}');
    if (jsonStart2 !== -1 && jsonEnd2 !== -1) {
      cleaned = cleaned.substring(jsonStart2, jsonEnd2 + 1);
    }

    const repaired = JSON.parse(cleaned);
    console.log('[JSON Repair] Successfully repaired JSON');
    return { success: true, repairedJson: repaired };

  } catch (error: any) {
    console.error('[JSON Repair] Repair failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to repair JSON'
    };
  }
}

/**
 * Generate safe fallback response when JSON repair fails
 */
export function generateSafeFallbackResponse(
  originalError?: string
): StructuredAIResponse {
  return {
    answer: "Thanks for reaching out! Our team will follow up with you shortly.",
    sources: [],
    confidence: 'low',
    needsHuman: true,
    followUpQuestion: "What can I help you with today? Are you looking for available units, pricing information, or have questions about our policies?",
    toolResults: []
  };
}

