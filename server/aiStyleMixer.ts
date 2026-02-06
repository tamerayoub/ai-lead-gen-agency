import { type StyleProfile } from "./aiAutoTrain";

/**
 * StyleMixer - Combines personality settings with StyleProfile
 * to generate style constraints for AI generation
 */

export interface PersonalitySettings {
  friendliness?: string;
  formality?: string;
  responseLength?: string;
  urgency?: string;
  warmth?: string;
  communicationStyle?: string;
}

export interface StyleConstraints {
  maxSentences?: number;
  allowContractions: boolean;
  urgencyPhrasesAllowed: string[];
  urgencyPhrasesDisallowed: string[];
  usePersonalization: boolean;
  personalizationTokens: string[];
  ctaStyle: 'gentle' | 'moderate' | 'strong';
  emojiPolicy: 'none' | 'light' | 'ok';
  formattingRules: {
    useBullets: boolean;
    useNumberedLists: boolean;
    paragraphBreaks: boolean;
  };
  greetingPatterns: string[];
  closingPatterns: string[];
  commonPhrases: string[];
  doNotUse: string[];
}

/**
 * Build style instructions from personality settings + style profile
 */
export function buildStyleInstructions(
  personalitySettings: PersonalitySettings,
  styleProfile: StyleProfile | null
): string {
  const constraints = buildStyleConstraints(personalitySettings, styleProfile);
  
  let instructions = 'STYLE AND TONE GUIDELINES:\n\n';

  // Response length
  if (constraints.maxSentences) {
    instructions += `- Response MUST be exactly ${constraints.maxSentences} sentence(s). No more, no less.\n`;
  } else if (personalitySettings.responseLength === 'one-paragraph') {
    instructions += `- Response MUST be exactly ONE paragraph. No bullet points, numbered lists, or line breaks. Write everything in a single, continuous paragraph.\n`;
  } else if (personalitySettings.responseLength === 'short') {
    instructions += `- Keep response concise (2-3 short paragraphs maximum). Get to the point quickly.\n`;
  } else {
    instructions += `- Provide detailed, thorough responses (3-4 paragraphs). Include comprehensive information.\n`;
  }

  // Formality and contractions
  if (constraints.allowContractions) {
    instructions += `- Use conversational language with contractions (I'm, you're, we've, etc.).\n`;
  } else {
    instructions += `- Use formal language with proper grammar. Avoid contractions.\n`;
  }

  // Friendliness
  if (personalitySettings.friendliness === 'friendly') {
    instructions += `- Write in a warm, approachable, and friendly tone. Use casual language and show enthusiasm.\n`;
  } else {
    instructions += `- Write in a professional and businesslike tone. Maintain a respectful and courteous demeanor.\n`;
  }

  // Urgency
  if (personalitySettings.urgency === 'high') {
    instructions += `- Create a sense of urgency and timeliness. Encourage quick action.\n`;
    if (constraints.urgencyPhrasesAllowed.length > 0) {
      instructions += `- You MAY use phrases like: ${constraints.urgencyPhrasesAllowed.slice(0, 3).join(', ')}\n`;
    }
  } else if (personalitySettings.urgency === 'low') {
    instructions += `- Maintain a relaxed, no-pressure approach. Avoid creating urgency.\n`;
    if (constraints.urgencyPhrasesDisallowed.length > 0) {
      instructions += `- Do NOT use phrases like: ${constraints.urgencyPhrasesDisallowed.slice(0, 3).join(', ')}\n`;
    }
  } else {
    instructions += `- Balance urgency with professionalism. Mention availability naturally without being pushy.\n`;
  }

  // Warmth
  if (personalitySettings.warmth === 'high') {
    instructions += `- Show genuine warmth and care. Use empathetic language and show personal interest.\n`;
    if (constraints.usePersonalization && constraints.personalizationTokens.length > 0) {
      instructions += `- Personalize when possible using: ${constraints.personalizationTokens.join(', ')}\n`;
    }
  } else if (personalitySettings.warmth === 'low') {
    instructions += `- Keep responses factual and straightforward. Maintain professional distance.\n`;
  } else {
    instructions += `- Show appropriate warmth while remaining professional. Be personable but not overly casual.\n`;
  }

  // Communication style
  if (personalitySettings.communicationStyle === 'sales-assist') {
    instructions += `- Adopt a sales-assist approach: highlight benefits, create excitement, guide toward application/showing, and overcome objections.\n`;
    instructions += `- CTA style: ${constraints.ctaStyle === 'strong' ? 'Encourage action with enthusiasm' : 'Guide gently toward next steps'}\n`;
  } else {
    instructions += `- Adopt an informational approach: provide clear information, answer questions thoroughly, and let the lead decide without pressure.\n`;
    instructions += `- CTA style: ${constraints.ctaStyle === 'gentle' ? 'Offer options without pressure' : 'Suggest next steps naturally'}\n`;
  }

  // Emoji policy
  if (constraints.emojiPolicy === 'none') {
    instructions += `- Do NOT use emojis.\n`;
  } else if (constraints.emojiPolicy === 'light') {
    instructions += `- Use emojis sparingly (maximum 1-2 per message, only if appropriate).\n`;
  } else {
    instructions += `- Emojis are acceptable if they fit the tone.\n`;
  }

  // Formatting
  if (!constraints.formattingRules.useBullets) {
    instructions += `- Do NOT use bullet points.\n`;
  }
  if (!constraints.formattingRules.useNumberedLists) {
    instructions += `- Do NOT use numbered lists.\n`;
  }
  if (!constraints.formattingRules.paragraphBreaks && personalitySettings.responseLength === 'one-paragraph') {
    instructions += `- Do NOT use paragraph breaks. Write in a single continuous paragraph.\n`;
  }

  // Style profile patterns
  if (styleProfile) {
    if (styleProfile.greetingPatterns.length > 0) {
      instructions += `\nGREETING PATTERNS (use similar style):\n${styleProfile.greetingPatterns.slice(0, 3).map(p => `- "${p}"`).join('\n')}\n`;
    }
    if (styleProfile.closingPatterns.length > 0) {
      instructions += `\nCLOSING PATTERNS (use similar style):\n${styleProfile.closingPatterns.slice(0, 3).map(p => `- "${p}"`).join('\n')}\n`;
    }
    if (styleProfile.commonPhrases.length > 0) {
      instructions += `\nCOMMON PHRASES (incorporate similar tone):\n${styleProfile.commonPhrases.slice(0, 5).map(p => `- "${p}"`).join('\n')}\n`;
    }
    if (styleProfile.doNotUse.length > 0) {
      instructions += `\nPHRASES TO AVOID:\n${styleProfile.doNotUse.map(p => `- "${p}"`).join('\n')}\n`;
    }
  }

  return instructions;
}

/**
 * Build style constraints from settings
 */
function buildStyleConstraints(
  personalitySettings: PersonalitySettings,
  styleProfile: StyleProfile | null
): StyleConstraints {
  // Determine max sentences based on response length
  let maxSentences: number | undefined;
  if (personalitySettings.responseLength === 'one-paragraph') {
    maxSentences = 5; // Approximate for one paragraph
  } else if (personalitySettings.responseLength === 'short') {
    maxSentences = 6; // 2-3 paragraphs
  }

  // Contractions
  const allowContractions = personalitySettings.formality === 'conversational';

  // Urgency phrases
  const urgencyPhrasesAllowed = [
    'limited availability',
    'act soon',
    'don\'t miss out',
    'available now',
    'schedule today'
  ];
  const urgencyPhrasesDisallowed = [
    'limited time offer',
    'must act now',
    'urgent',
    'hurry',
    'last chance'
  ];

  // Personalization
  const usePersonalization = personalitySettings.warmth === 'high';
  const personalizationTokens: string[] = [];
  if (styleProfile?.personalizationTokensAllowed) {
    personalizationTokens.push(...styleProfile.personalizationTokensAllowed);
  } else if (usePersonalization) {
    personalizationTokens.push('name', 'move_in_date');
  }

  // CTA style
  let ctaStyle: 'gentle' | 'moderate' | 'strong' = 'moderate';
  if (personalitySettings.communicationStyle === 'sales-assist') {
    ctaStyle = personalitySettings.urgency === 'high' ? 'strong' : 'moderate';
  } else {
    ctaStyle = 'gentle';
  }

  // Emoji policy
  const emojiPolicy = styleProfile?.emojiPolicy || 'none';

  // Formatting
  const formattingRules = styleProfile?.formattingPreferences || {
    useBullets: false,
    useNumberedLists: false,
    paragraphBreaks: personalitySettings.responseLength !== 'one-paragraph'
  };

  return {
    maxSentences,
    allowContractions,
    urgencyPhrasesAllowed,
    urgencyPhrasesDisallowed,
    usePersonalization,
    personalizationTokens,
    ctaStyle,
    emojiPolicy,
    formattingRules,
    greetingPatterns: styleProfile?.greetingPatterns || [],
    closingPatterns: styleProfile?.closingPatterns || [],
    commonPhrases: styleProfile?.commonPhrases || [],
    doNotUse: styleProfile?.doNotUse || []
  };
}

/**
 * Post-process response to enforce length constraints.
 * Protects URLs from being split on periods (e.g. https://www.example.com) so
 * booking links are not truncated mid-URL.
 */
export function enforceLengthConstraint(
  answer: string,
  maxSentences?: number
): string {
  if (!maxSentences) return answer;

  // Protect URLs: periods inside URLs would be wrongly treated as sentence boundaries.
  // Replace URLs with placeholders before splitting.
  const urlPattern = /(https?:\/\/[^\s)\]'">]+)/g;
  const urls: string[] = [];
  const withPlaceholders = answer.replace(urlPattern, (match) => {
    urls.push(match);
    return `__URL_${urls.length - 1}__`;
  });

  const sentences = withPlaceholders.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (sentences.length <= maxSentences) {
    return answer;
  }

  // Take first maxSentences and ensure proper ending
  let truncated = sentences.slice(0, maxSentences).join('. ').trim();

  // Restore URLs from placeholders
  urls.forEach((url, i) => {
    truncated = truncated.replace(`__URL_${i}__`, url);
  });

  // Ensure it ends with punctuation
  if (!truncated.match(/[.!?]$/)) {
    truncated += '.';
  }

  return truncated;
}

