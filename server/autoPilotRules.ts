/**
 * Auto-Pilot Mode Rules and Decision Logic
 * 
 * Determines if an AI reply should be sent automatically (auto-pilot) 
 * or require human approval (co-pilot) based on:
 * - Business hours
 * - Question type
 * - Confidence level
 */

interface AutoPilotSettings {
  enabled: boolean;
  businessHoursOnly?: boolean;
  businessHoursStart?: string; // HH:mm format, e.g., "09:00"
  businessHoursEnd?: string; // HH:mm format, e.g., "17:00"
  businessDays?: string[]; // e.g., ["monday", "tuesday", "wednesday", "thursday", "friday"]
  allowedQuestionTypes?: string[]; // e.g., ["availability", "pricing", "general"]
  minConfidenceLevel?: "high" | "medium" | "low"; // Minimum confidence to auto-send
  timezone?: string; // IANA timezone, e.g., "America/Chicago"
}

interface MessageAnalysis {
  questionType: string; // "availability", "pricing", "general", "sensitive", "application"
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

/**
 * Check if current time is within business hours
 */
export function isWithinBusinessHours(
  settings: AutoPilotSettings,
  currentTime: Date = new Date()
): boolean {
  if (!settings.businessHoursOnly) {
    return true; // No business hours restriction
  }

  if (!settings.businessHoursStart || !settings.businessHoursEnd) {
    return true; // No business hours configured, allow all times
  }

  const timezone = settings.timezone || "America/Chicago";
  
  // Use date-fns-tz to check time in the specified timezone
  let dayOfWeek: string;
  let currentTimeStr: string;
  try {
    const { formatInTimeZone } = require("date-fns-tz");
    dayOfWeek = formatInTimeZone(currentTime, timezone, "EEEE").toLowerCase();
    currentTimeStr = formatInTimeZone(currentTime, timezone, "HH:mm");
  } catch (error) {
    // Fallback to locale if date-fns-tz not available
    dayOfWeek = currentTime.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone }).toLowerCase();
    currentTimeStr = currentTime.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: timezone });
  }

  // Check if current day is a business day
  if (settings.businessDays && settings.businessDays.length > 0) {
    if (!settings.businessDays.includes(dayOfWeek)) {
      return false;
    }
  }

  // Compare times (HH:mm format)
  return currentTimeStr >= settings.businessHoursStart && currentTimeStr <= settings.businessHoursEnd;
}

/**
 * Analyze message to determine question type and confidence
 */
export async function analyzeMessageForAutoPilot(
  message: string,
  openai: any
): Promise<MessageAnalysis> {
  try {
    const analysisPrompt = `Analyze this rental inquiry message and determine:
1. Question type (availability, pricing, general, sensitive, application)
2. Confidence level (high, medium, low) for auto-responding
3. Brief reasoning

Message: ${message.substring(0, 1000)}

Question types:
- "availability": Questions about property/unit availability, viewing times, tours
- "pricing": Questions about rent, deposits, fees, pricing
- "general": General questions about property details, amenities, location
- "sensitive": Questions about legal issues, complaints, disputes, or requiring human judgment
- "application": Questions about application process, qualifications, requirements

Confidence levels:
- "high": Clear, straightforward question that can be answered confidently
- "medium": Question that can be answered but may need human review
- "low": Ambiguous, complex, or sensitive question requiring human intervention

Respond with a JSON object:
{
  "questionType": "availability" | "pricing" | "general" | "sensitive" | "application",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return {
      questionType: result.questionType || "general",
      confidence: result.confidence || "medium",
      reasoning: result.reasoning || "Analyzed message",
    };
  } catch (error) {
    console.error("[Auto-Pilot] Error analyzing message:", error);
    // Default to medium confidence, general type on error (fail-safe: require approval)
    return {
      questionType: "general",
      confidence: "medium",
      reasoning: "Error analyzing message - requiring human review",
    };
  }
}

/**
 * Determine if auto-pilot should send this reply automatically
 * Returns { shouldAutoSend: boolean, reason: string, confidence: string }
 */
export function shouldAutoSend(
  settings: AutoPilotSettings,
  analysis: MessageAnalysis,
  currentTime: Date = new Date()
): { shouldAutoSend: boolean; reason: string; confidence: string } {
  if (!settings.enabled) {
    return {
      shouldAutoSend: false,
      reason: "Auto-pilot mode is disabled",
      confidence: analysis.confidence,
    };
  }

  // Check business hours
  if (!isWithinBusinessHours(settings, currentTime)) {
    return {
      shouldAutoSend: false,
      reason: "Outside business hours",
      confidence: analysis.confidence,
    };
  }

  // Check question type
  if (settings.allowedQuestionTypes && settings.allowedQuestionTypes.length > 0) {
    if (!settings.allowedQuestionTypes.includes(analysis.questionType)) {
      return {
        shouldAutoSend: false,
        reason: `Question type "${analysis.questionType}" not allowed for auto-pilot`,
        confidence: analysis.confidence,
      };
    }
  }

  // Block sensitive questions
  if (analysis.questionType === "sensitive") {
    return {
      shouldAutoSend: false,
      reason: "Sensitive question type requires human review",
      confidence: analysis.confidence,
    };
  }

  // Check confidence level
  const minConfidence = settings.minConfidenceLevel || "high";
  const confidenceLevels = { low: 0, medium: 1, high: 2 };
  if (confidenceLevels[analysis.confidence] < confidenceLevels[minConfidence]) {
    return {
      shouldAutoSend: false,
      reason: `Confidence level "${analysis.confidence}" below minimum "${minConfidence}"`,
      confidence: analysis.confidence,
    };
  }

  // All checks passed
  return {
    shouldAutoSend: true,
    reason: `Auto-approved: ${analysis.questionType} question with ${analysis.confidence} confidence`,
    confidence: analysis.confidence,
  };
}

