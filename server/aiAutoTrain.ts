import OpenAI from "openai";
import { storage } from "./storage";

/**
 * Auto Train AI - Learns style and intent patterns from historical conversations
 * 
 * CRITICAL: This module ONLY learns:
 * - Style patterns (greetings, closings, tone, formatting)
 * - Intent routing patterns (common questions, follow-ups)
 * 
 * This module NEVER learns:
 * - Factual data (prices, availability, dates, unit numbers)
 * - Policy details (these come from DB/vector store)
 * - Property-specific facts
 */

export interface StyleProfile {
  greetingPatterns: string[];
  closingPatterns: string[];
  commonPhrases: string[];
  emojiPolicy: 'none' | 'light' | 'ok';
  personalizationTokensAllowed: ('name' | 'unit' | 'move_in_date')[];
  doNotUse: string[]; // Phrases to avoid (aggressive pressure, etc.)
  formattingPreferences: {
    useBullets: boolean;
    useNumberedLists: boolean;
    paragraphBreaks: boolean;
  };
}

export interface IntentPlaybook {
  intents: Array<{
    name: string;
    exampleUtterances: string[]; // Lead questions, NOT agent responses
    requiredFields: string[]; // e.g., ['propertyId'] for availability
    recommendedTools: string[]; // e.g., ['get_availability']
    defaultFollowUpQuestion?: string;
  }>;
}

export interface ConversationMessage {
  type: 'incoming' | 'outgoing' | 'received' | 'sent';
  message: string;
  createdAt: Date;
  leadId: string;
}

/**
 * Build StyleProfile from historical agent messages
 * Extracts tone, formatting, and style patterns ONLY
 */
export async function buildStyleProfile(
  openai: OpenAI,
  messages: ConversationMessage[]
): Promise<StyleProfile> {
  // Filter to only agent messages (outgoing/sent)
  const agentMessages = messages.filter(m => 
    m.type === 'outgoing' || m.type === 'sent'
  );

  if (agentMessages.length === 0) {
    // Return default profile
    return {
      greetingPatterns: [],
      closingPatterns: [],
      commonPhrases: [],
      emojiPolicy: 'none',
      personalizationTokensAllowed: [],
      doNotUse: [],
      formattingPreferences: {
        useBullets: false,
        useNumberedLists: false,
        paragraphBreaks: true
      }
    };
  }

  // Extract messages (limit to last 100 for performance)
  const recentMessages = agentMessages.slice(-100).map(m => m.message).join('\n\n---\n\n');

  const analysisPrompt = `Analyze these historical agent messages and extract ONLY style and tone patterns. 
DO NOT extract any factual information (prices, dates, unit numbers, availability, policies).

Messages:
${recentMessages}

Extract and return JSON with:
{
  "greetingPatterns": ["common greeting phrases used"],
  "closingPatterns": ["common closing phrases used"],
  "commonPhrases": ["frequently used phrases that show tone/style"],
  "emojiPolicy": "none" | "light" | "ok" (based on emoji usage frequency),
  "personalizationTokensAllowed": ["name", "unit", "move_in_date"] (if lead name/unit/move-in date are used),
  "doNotUse": ["phrases that should be avoided - aggressive pressure, pushy language"],
  "formattingPreferences": {
    "useBullets": true/false,
    "useNumberedLists": true/false,
    "paragraphBreaks": true/false
  }
}

CRITICAL RULES:
- Do NOT include any prices, dates, unit numbers, or property names
- Do NOT include policy details or factual claims
- Only extract style patterns: how they greet, how they close, tone, formatting
- If emojis are never used, set emojiPolicy to "none"
- If emojis are used occasionally, set to "light"
- If emojis are common, set to "ok"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: analysisPrompt
      }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and sanitize
    return {
      greetingPatterns: Array.isArray(result.greetingPatterns) ? result.greetingPatterns.slice(0, 10) : [],
      closingPatterns: Array.isArray(result.closingPatterns) ? result.closingPatterns.slice(0, 10) : [],
      commonPhrases: Array.isArray(result.commonPhrases) ? result.commonPhrases.slice(0, 20) : [],
      emojiPolicy: ['none', 'light', 'ok'].includes(result.emojiPolicy) ? result.emojiPolicy : 'none',
      personalizationTokensAllowed: Array.isArray(result.personalizationTokensAllowed) 
        ? result.personalizationTokensAllowed.filter((t: string) => ['name', 'unit', 'move_in_date'].includes(t))
        : [],
      doNotUse: Array.isArray(result.doNotUse) ? result.doNotUse.slice(0, 10) : [],
      formattingPreferences: {
        useBullets: result.formattingPreferences?.useBullets === true,
        useNumberedLists: result.formattingPreferences?.useNumberedLists === true,
        paragraphBreaks: result.formattingPreferences?.paragraphBreaks !== false
      }
    };
  } catch (error) {
    console.error('[Auto Train] Error building style profile:', error);
    // Return default on error
    return {
      greetingPatterns: [],
      closingPatterns: [],
      commonPhrases: [],
      emojiPolicy: 'none',
      personalizationTokensAllowed: [],
      doNotUse: [],
      formattingPreferences: {
        useBullets: false,
        useNumberedLists: false,
        paragraphBreaks: true
      }
    };
  }
}

/**
 * Build IntentPlaybook from historical lead messages
 * Extracts common intents and routing patterns
 */
export async function buildIntentPlaybook(
  openai: OpenAI,
  messages: ConversationMessage[]
): Promise<IntentPlaybook> {
  // Filter to only lead messages (incoming/received)
  const leadMessages = messages.filter(m => 
    m.type === 'incoming' || m.type === 'received'
  );

  if (leadMessages.length === 0) {
    return { intents: [] };
  }

  // Extract lead messages (limit to last 200 for performance)
  const recentLeadMessages = leadMessages.slice(-200).map(m => m.message);

  // Simple heuristic clustering first
  const intentClusters: Record<string, string[]> = {
    qualifications: [],
    faq_policy: [],
    availability: [],
    pricing: [],
    scheduling: [],
    application_status: []
  };

  // Keyword-based clustering
  recentLeadMessages.forEach(msg => {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.match(/\b(qualif|requirement|credit|income|eviction|screening|background)\b/)) {
      intentClusters.qualifications.push(msg);
    } else if (lowerMsg.match(/\b(available|vacant|unit|apartment|have.*available)\b/)) {
      intentClusters.availability.push(msg);
    } else if (lowerMsg.match(/\b(price|rent|cost|deposit|fee|how much)\b/)) {
      intentClusters.pricing.push(msg);
    } else if (lowerMsg.match(/\b(tour|showing|view|see|schedule|appointment|visit)\b/)) {
      intentClusters.scheduling.push(msg);
    } else if (lowerMsg.match(/\b(status|application|approved|denied|screening)\b/)) {
      intentClusters.application_status.push(msg);
    } else {
      intentClusters.faq_policy.push(msg);
    }
  });

  // Use OpenAI to refine and extract patterns
  const refinementPrompt = `Analyze these lead messages grouped by intent and extract routing patterns.

QUALIFICATIONS messages (${intentClusters.qualifications.length}):
${intentClusters.qualifications.slice(0, 20).join('\n')}

AVAILABILITY messages (${intentClusters.availability.length}):
${intentClusters.availability.slice(0, 20).join('\n')}

PRICING messages (${intentClusters.pricing.length}):
${intentClusters.pricing.slice(0, 20).join('\n')}

SCHEDULING messages (${intentClusters.scheduling.length}):
${intentClusters.scheduling.slice(0, 20).join('\n')}

APPLICATION_STATUS messages (${intentClusters.application_status.length}):
${intentClusters.application_status.slice(0, 20).join('\n')}

FAQ_POLICY messages (${intentClusters.faq_policy.length}):
${intentClusters.faq_policy.slice(0, 20).join('\n')}

Return JSON with intent playbook:
{
  "intents": [
    {
      "name": "qualifications",
      "exampleUtterances": ["example lead questions - NO prices/dates/unit numbers"],
      "requiredFields": ["propertyId"] (if property-specific),
      "recommendedTools": ["get_qualifications"],
      "defaultFollowUpQuestion": "optional follow-up if unclear"
    },
    ... (repeat for each intent with messages)
  ]
}

CRITICAL RULES:
- exampleUtterances must be lead questions, NOT agent responses
- Do NOT include any prices, dates, unit numbers, or specific property names
- Only include intents that have at least 3 example messages
- requiredFields should indicate what's needed before calling tools
- recommendedTools should match the intent (get_availability, quote_price, get_tour_slots, get_qualifications, get_application_status)`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: refinementPrompt
      }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and sanitize
    const intents = Array.isArray(result.intents) ? result.intents
      .filter((intent: any) => 
        intent.name && 
        Array.isArray(intent.exampleUtterances) && 
        intent.exampleUtterances.length >= 3
      )
      .map((intent: any) => ({
        name: intent.name,
        exampleUtterances: intent.exampleUtterances.slice(0, 10), // Limit examples
        requiredFields: Array.isArray(intent.requiredFields) ? intent.requiredFields : [],
        recommendedTools: Array.isArray(intent.recommendedTools) ? intent.recommendedTools : [],
        defaultFollowUpQuestion: typeof intent.defaultFollowUpQuestion === 'string' 
          ? intent.defaultFollowUpQuestion 
          : undefined
      }))
      : [];

    return { intents };
  } catch (error) {
    console.error('[Auto Train] Error building intent playbook:', error);
    return { intents: [] };
  }
}

/**
 * Load historical conversations for training
 */
export async function loadTrainingConversations(
  orgId: string,
  windowDays: number = 90,
  propertyId?: string
): Promise<ConversationMessage[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    // Get all leads for this org (and optionally property)
    const allLeads = await storage.getAllLeads(orgId);
    const relevantLeadIds = propertyId
      ? allLeads.filter(l => l.propertyId === propertyId).map(l => l.id)
      : allLeads.map(l => l.id);

    if (relevantLeadIds.length === 0) {
      return [];
    }

    // Get conversations for these leads
    const allMessages: ConversationMessage[] = [];
    for (const leadId of relevantLeadIds.slice(0, 100)) { // Limit to 100 leads for performance
      try {
        const conversations = await storage.getConversationsByLeadId(leadId, orgId);
        const filtered = conversations
          .filter(c => new Date(c.createdAt) >= cutoffDate)
          .map(c => ({
            type: c.type as 'incoming' | 'outgoing' | 'received' | 'sent',
            message: c.message,
            createdAt: new Date(c.createdAt),
            leadId: c.leadId
          }));
        allMessages.push(...filtered);
      } catch (error) {
        // Skip if error
        console.error(`[Auto Train] Error loading conversations for lead ${leadId}:`, error);
      }
    }

    // Sort by date
    allMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return allMessages;
  } catch (error) {
    console.error('[Auto Train] Error loading training conversations:', error);
    return [];
  }
}

/**
 * Main training function
 */
export async function trainAI(
  openai: OpenAI,
  orgId: string,
  options: {
    propertyId?: string;
    windowDays?: number;
    dryRun?: boolean;
  } = {}
): Promise<{
  styleProfile: StyleProfile;
  intentPlaybook: IntentPlaybook;
  messageCount: number;
  saved: boolean;
}> {
  const { propertyId, windowDays = 90, dryRun = false } = options;

  console.log(`[Auto Train] Starting training for org ${orgId}${propertyId ? `, property ${propertyId}` : ''}`);

  // Load conversations
  const messages = await loadTrainingConversations(orgId, windowDays, propertyId);
  console.log(`[Auto Train] Loaded ${messages.length} messages`);

  if (messages.length < 10) {
    console.log('[Auto Train] Not enough messages for training (minimum 10 required)');
    return {
      styleProfile: await buildStyleProfile(openai, []),
      intentPlaybook: await buildIntentPlaybook(openai, []),
      messageCount: messages.length,
      saved: false
    };
  }

  // Build profiles
  const [styleProfile, intentPlaybook] = await Promise.all([
    buildStyleProfile(openai, messages),
    buildIntentPlaybook(openai, messages)
  ]);

  console.log(`[Auto Train] Built style profile (${styleProfile.greetingPatterns.length} greetings, ${styleProfile.closingPatterns.length} closings)`);
  console.log(`[Auto Train] Built intent playbook (${intentPlaybook.intents.length} intents)`);

  // Save if not dry run
  if (!dryRun) {
    const category = 'ai_auto_train';
    const orgKey = propertyId ? `property_${propertyId}` : 'organization';

    // Save style profile
    await storage.upsertAISetting({
      category,
      key: `${orgKey}_style_profile`,
      value: JSON.stringify(styleProfile),
      orgId
    });

    // Save intent playbook
    await storage.upsertAISetting({
      category,
      key: `${orgKey}_intent_playbook`,
      value: JSON.stringify(intentPlaybook),
      orgId
    });

    // Save metadata
    await storage.upsertAISetting({
      category,
      key: `${orgKey}_metadata`,
      value: JSON.stringify({
        lastTrainedAt: new Date().toISOString(),
        trainingSourceWindowDays: windowDays,
        messageCount: messages.length,
        enabled: true
      }),
      orgId
    });

    console.log(`[Auto Train] Saved training artifacts for ${orgKey}`);
  }

  return {
    styleProfile,
    intentPlaybook,
    messageCount: messages.length,
    saved: !dryRun
  };
}

/**
 * Load trained artifacts from storage
 */
export async function loadTrainedArtifacts(
  orgId: string,
  propertyId?: string
): Promise<{
  styleProfile: StyleProfile | null;
  intentPlaybook: IntentPlaybook | null;
  enabled: boolean;
}> {
  try {
    const category = 'ai_auto_train';
    const orgKey = propertyId ? `property_${propertyId}` : 'organization';

    const settings = await storage.getAISettings(category, orgId);
    
    const styleProfileSetting = settings.find(s => s.key === `${orgKey}_style_profile`);
    const intentPlaybookSetting = settings.find(s => s.key === `${orgKey}_intent_playbook`);
    const metadataSetting = settings.find(s => s.key === `${orgKey}_metadata`);

    const metadata = metadataSetting?.value 
      ? JSON.parse(metadataSetting.value as string)
      : { enabled: false };

    return {
      styleProfile: styleProfileSetting?.value 
        ? JSON.parse(styleProfileSetting.value as string) as StyleProfile
        : null,
      intentPlaybook: intentPlaybookSetting?.value
        ? JSON.parse(intentPlaybookSetting.value as string) as IntentPlaybook
        : null,
      enabled: metadata.enabled === true
    };
  } catch (error) {
    console.error('[Auto Train] Error loading trained artifacts:', error);
    return {
      styleProfile: null,
      intentPlaybook: null,
      enabled: false
    };
  }
}

