import OpenAI from "openai";
import { storage } from "./storage";
import { getAvailabilityContext } from "./calendarAvailability";

interface AIReplyOptions {
  orgId: string;
  leadMessage: string;
  propertyId?: string | null;
  property?: any;
  propertyUnits?: any[];
  allPropertiesWithUnits?: any[];
  lead?: {
    id: string;
    name: string;
    propertyName?: string | null;
    moveInDate?: string | null;
    propertyId?: string | null;
  };
  leadNotes?: any[];
  conversations?: any[];
  conversationHistory?: any[]; // For practice mode
  organization?: any;
  userName?: string;
  userEmail?: string;
  orgName?: string;
  suggestedTimeSlots?: any[];
  bookingLink?: string;
  isPracticeMode?: boolean;
}

/**
 * Centralized AI reply generation function used by both real AI Leasing Agent and Interactive Training
 * This ensures both endpoints use the exact same logic
 */
export async function generateAIReply(
  openai: OpenAI,
  options: AIReplyOptions
): Promise<string> {
  const {
    orgId,
    leadMessage,
    propertyId,
    property: initialProperty,
    propertyUnits: initialPropertyUnits = [],
    allPropertiesWithUnits = [],
    lead,
    leadNotes = [],
    conversations = [],
    conversationHistory = [],
    organization,
    userName = 'Property Manager',
    userEmail = '',
    orgName = 'Our Property Management',
    suggestedTimeSlots = [],
    bookingLink,
    isPracticeMode = false,
  } = options;
  
  // Use mutable variables for property and units (may be updated if property is detected from message)
  let property = initialProperty;
  let propertyUnits = initialPropertyUnits;

  // Get organization AI settings (brand voice, policies)
  const orgAISettings = await storage.getAISettings('organization', orgId);
  const brandVoice = orgAISettings.find(s => s.key === 'brand_voice')?.value;
  const policies = orgAISettings.find(s => s.key === 'policies')?.value;

  // Get personality/tone settings
  const personalitySettings = await storage.getAISettings('personality', orgId);
  const friendliness = personalitySettings.find(s => s.key === 'friendliness')?.value || 'professional';
  const formality = personalitySettings.find(s => s.key === 'formality')?.value || 'professional';
  const responseLength = personalitySettings.find(s => s.key === 'response_length')?.value || 'detailed';
  const urgency = personalitySettings.find(s => s.key === 'urgency')?.value || 'moderate';
  const warmth = personalitySettings.find(s => s.key === 'warmth')?.value || 'moderate';
  const communicationStyle = personalitySettings.find(s => s.key === 'communication_style')?.value || 'informational';

  // Get training content (auto-generated from historical conversations)
  const trainingSettings = await storage.getAISettings('training', orgId);
  const trainingContentRaw = trainingSettings.find(s => s.key === 'auto_training_content')?.value;
  const trainingContent = trainingContentRaw ? trainingContentRaw.substring(0, 2000) : null;

  // Get corrections (examples of correct responses from interactive training)
  const correctionsSettings = await storage.getAISettings('training_corrections', orgId);
  const correctionsData = correctionsSettings.find(s => s.key === 'corrections')?.value;
  let correctionsContext = '';
  if (correctionsData) {
    try {
      const corrections = JSON.parse(correctionsData);
      if (Array.isArray(corrections) && corrections.length > 0) {
        correctionsContext = '\n\nCORRECTED EXAMPLES (learn from these - these are the RIGHT way to respond):\n';
        corrections.slice(-20).forEach((correction: any, idx: number) => {
          correctionsContext += `\nExample ${idx + 1}:\n`;
          correctionsContext += `Lead said: "${correction.leadMessage}"\n`;
          correctionsContext += `Wrong response: "${correction.originalMessage}"\n`;
          correctionsContext += `Correct response: "${correction.correctedMessage}"\n`;
        });
      }
    } catch (e) {
      console.error('[AI Reply Generator] Error parsing corrections:', e);
    }
  }

  // Get leasing rules (qualification settings) - ALWAYS fetch org-level, property-level overrides if propertyId provided
  let qualificationSettings = await storage.getOrgQualificationSettings(orgId);
  let finalPropertyId = propertyId || lead?.propertyId;
  
  // For Facebook leads, skip property availability checking - they're already associated with a specific listing
  const leadAny = lead as any; // Type assertion for metadata access
  const isFacebookLead = leadAny?.source === 'facebook' || leadAny?.metadata?.facebookListingId || leadAny?.metadata?.facebookProfileId;
  
  // Helper function to normalize address abbreviations for matching
  const normalizeAddress = (address: string): string => {
    if (!address) return '';
    let normalized = address.toLowerCase().trim();
    // Normalize common address abbreviations
    const abbreviations: Record<string, string> = {
      '\\bst\\b': 'street',
      '\\bave\\b': 'avenue',
      '\\brd\\b': 'road',
      '\\bdr\\b': 'drive',
      '\\bln\\b': 'lane',
      '\\bblvd\\b': 'boulevard',
      '\\bct\\b': 'court',
      '\\bpl\\b': 'place',
      '\\bpkwy\\b': 'parkway',
      '\\bway\\b': 'way',
      '\\bcir\\b': 'circle',
      '\\btrl\\b': 'trail',
    };
    for (const [abbrev, full] of Object.entries(abbreviations)) {
      normalized = normalized.replace(new RegExp(abbrev, 'gi'), full);
    }
    // Remove extra spaces and punctuation
    normalized = normalized.replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
    return normalized;
  };

  // Helper function to check if two addresses match (handles abbreviations)
  const addressesMatch = (address1: string, address2: string): boolean => {
    if (!address1 || !address2) return false;
    const norm1 = normalizeAddress(address1);
    const norm2 = normalizeAddress(address2);
    
    // Exact match after normalization
    if (norm1 === norm2) return true;
    
    // Check if one contains the other (for partial matches)
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    // Extract street number and name for more flexible matching
    const extractStreetParts = (addr: string) => {
      const normalized = normalizeAddress(addr);
      const numberMatch = normalized.match(/^(\d+)/);
      const number = numberMatch ? numberMatch[1] : '';
      const rest = normalized.replace(/^\d+\s*/, '').trim();
      return { number, rest };
    };
    
    const parts1 = extractStreetParts(address1);
    const parts2 = extractStreetParts(address2);
    
    // If both have numbers, they must match
    if (parts1.number && parts2.number && parts1.number !== parts2.number) {
      return false;
    }
    
    // Check if street names match (after normalization)
    if (parts1.rest && parts2.rest) {
      const normRest1 = normalizeAddress(parts1.rest);
      const normRest2 = normalizeAddress(parts2.rest);
      if (normRest1 === normRest2 || normRest1.includes(normRest2) || normRest2.includes(normRest1)) {
        return true;
      }
    }
    
    return false;
  };

  // Detect if lead is asking about a specific property/address/unit
  let propertyMention: string | null = null;
  let matchedProperty: any = null;
  let propertyNotFoundWarning = '';
  
  if (leadMessage) {
    const messageLower = leadMessage.toLowerCase();
    
    // Try to extract property address, name, or unit number from message
    // Look for patterns like "is 2427 available", "123 Main Street", "unit 3", etc.
    const patterns = [
      /(?:is|are|this|that)\s+([A-Z0-9][^?.,!]*?)(?:\s+available|\?|$)/i,  // "is 2427 available", "is this 2427 available"
      /(?:for|at|about|of)\s+([A-Z0-9][^?.,!]*?)(?:\s+available|\?|\.|,|!|$)/i,  // "for 123 Main Street", "about unit 3"
      /([0-9]+\s+[A-Z][^?.,!]*?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl))(?:\s+available|\?|\.|,|!|$)/i,  // Direct address pattern
      /^([0-9]+)(?:\s+available|\?|$)/i,  // Just a number like "2427" or "2427 available"
      /(?:unit|apt|apartment)\s+([A-Z0-9]+)/i,  // "unit 3", "apt 5"
    ];
    
    for (const pattern of patterns) {
      const match = leadMessage.match(pattern);
      if (match) {
        propertyMention = match[1].trim();
        break;
      }
    }
    
    // If no pattern matched but message starts with a number, use that
    if (!propertyMention && /^\d+/.test(leadMessage.trim())) {
      propertyMention = leadMessage.trim().match(/^(\d+)/)?.[1] || null;
    }
    
    // Skip property matching for Facebook leads - they're already associated with a specific listing
    if (propertyMention && !isFacebookLead) {
      // Get all properties and try to find a match
      const allProperties = await storage.getAllProperties(orgId);
      matchedProperty = allProperties.find((p: any) => {
        const propAddress = p.address || '';
        const propName = p.name || '';
        const mention = propertyMention!;
        
        // Use normalized address matching
        if (addressesMatch(mention, propAddress)) {
          return true;
        }
        
        // Also check property name
        const normMention = normalizeAddress(mention);
        const normName = normalizeAddress(propName);
        if (normName && (normName.includes(normMention) || normMention.includes(normName))) {
          return true;
        }
        
        // Fallback: check if mention contains key parts of address (street number + street name)
        const mentionLower = mention.toLowerCase();
        const addressLower = propAddress.toLowerCase();
        if (mentionLower.match(/^\d+/) && addressLower.match(/^\d+/)) {
          // Both have numbers, check if they match and rest is similar
          const mentionNum = mentionLower.match(/^(\d+)/)?.[1];
          const addressNum = addressLower.match(/^(\d+)/)?.[1];
          if (mentionNum === addressNum) {
            // Numbers match, check if rest of address is similar
            const mentionRest = normalizeAddress(mentionLower.replace(/^\d+\s*/, ''));
            const addressRest = normalizeAddress(addressLower.replace(/^\d+\s*/, ''));
            if (mentionRest && addressRest && (mentionRest.includes(addressRest) || addressRest.includes(mentionRest))) {
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (matchedProperty) {
        finalPropertyId = matchedProperty.id;
        console.log(`[AI Reply Generator] Detected property mention "${propertyMention}", found property: ${matchedProperty.name || matchedProperty.address} (${matchedProperty.id})`);
      } else {
        // Property not found - create warning for AI
        propertyNotFoundWarning = `\n\n⚠️ CRITICAL: The lead asked about "${propertyMention}" but this property/address/unit is NOT in your database/portfolio. DO NOT confirm it is available. Politely inform the lead that you don't have that property/address/unit in your portfolio, and offer to help them find available properties from your actual listings instead.`;
        console.log(`[AI Reply Generator] ⚠️ Property/address "${propertyMention}" NOT FOUND in database - will warn AI not to confirm availability`);
      }
    }
  }
  
  if (finalPropertyId) {
    const propertyQualificationSettings = await storage.getPropertyQualificationSettings(finalPropertyId, orgId);
    if (propertyQualificationSettings) {
      qualificationSettings = propertyQualificationSettings;
      console.log(`[AI Reply Generator] Using property-level qualification settings for property ${finalPropertyId}`);
    } else {
      console.log(`[AI Reply Generator] Property ${finalPropertyId} has no qualification overrides, using org-level settings`);
    }
    
    // If property was detected from message but not passed in, fetch it now
    if (!property && finalPropertyId) {
      property = await storage.getProperty(finalPropertyId, orgId);
      console.log(`[AI Reply Generator] Fetched property from detected finalPropertyId:`, property ? { id: property.id, name: property.name, address: property.address } : 'NOT FOUND');
      
      // If property found, fetch and filter its units
      if (property && propertyUnits.length === 0) {
        const allUnits = await storage.getAllUnitsByProperty(property.id, orgId);
        propertyUnits = allUnits.filter(unit => 
          unit.isListed && 
          unit.status === 'not_occupied' && 
          unit.bookingEnabled === true
        );
        console.log(`[AI Reply Generator] Fetched ${propertyUnits.length} available units for detected property (listed + available + booking enabled)`);
      }
    }
  }
  
  // Debug logging for qualifications
  console.log(`[AI Reply Generator] Qualification settings check:`, {
    orgId,
    propertyId: finalPropertyId || null,
    hasSettings: !!qualificationSettings,
    qualifications: qualificationSettings?.qualifications,
    qualificationsType: typeof qualificationSettings?.qualifications,
    qualificationsIsArray: Array.isArray(qualificationSettings?.qualifications),
    qualificationsLength: Array.isArray(qualificationSettings?.qualifications) ? qualificationSettings.qualifications.length : 'N/A'
  });

  // Build property context
  let propertyContext = '';
  if (property) {
    propertyContext = `\n\nPROPERTY INFORMATION (use accurate information from database):
Property: ${property.name}
Address: ${property.address}
${property.description ? `Description: ${property.description}` : ''}
${property.amenities && property.amenities.length > 0 ? `Amenities: ${property.amenities.join(', ')}` : ''}`;

    // Add available units information
    if (propertyUnits.length > 0) {
      propertyContext += `\n\nAVAILABLE UNITS (current database values - format as: "{bedrooms} bed/{bathrooms} bath, {property address} Apartment Unit {unitNumber}"):`;
      propertyUnits.slice(0, 5).forEach((unit) => {
        const bedBath = unit.bedrooms && unit.bathrooms 
          ? `${unit.bedrooms} bed/${unit.bathrooms} bath`
          : unit.bedrooms 
            ? `${unit.bedrooms} bed`
            : unit.bathrooms
              ? `${unit.bathrooms} bath`
              : '';
        propertyContext += `\n${bedBath ? bedBath + ', ' : ''}${property.address} Apartment Unit ${unit.unitNumber}`;
        if (unit.monthlyRent) propertyContext += ` - $${parseFloat(unit.monthlyRent).toLocaleString()}/month`;
        if (unit.leaseStartDate) propertyContext += ` - Available: ${unit.leaseStartDate}`;
      });
      if (propertyUnits.length > 5) {
        propertyContext += `\n...and ${propertyUnits.length - 5} more available units`;
      }
      propertyContext += `\n\n⚠️ CRITICAL AVAILABILITY RULE: This property HAS ${propertyUnits.length} available unit(s) listed above. You CAN confirm availability for this property. Only mention the units listed above - do not make up or guess about other units.`;
    } else {
      propertyContext += `\n\n⚠️ CRITICAL AVAILABILITY RULE: This property has NO available units in the database (no units are listed, available, and have booking enabled). DO NOT confirm this property is available. If the lead asks about availability, politely inform them that this property does not currently have any available units, and offer to help them find other available properties from your listings instead.`;
    }
  } else if (allPropertiesWithUnits.length > 0) {
    // Build context for ALL available properties when question is about available properties
    propertyContext = `\n\nALL AVAILABLE PROPERTIES AND UNITS (current database values - use these exact details):\nFormat each unit as: "{bedrooms} bed/{bathrooms} bath, {property address} Apartment Unit {unitNumber}"\n\n`;
    allPropertiesWithUnits.forEach((prop) => {
      if (prop.listedUnits && prop.listedUnits.length > 0) {
        prop.listedUnits.slice(0, 10).forEach((unit: any) => {
          const bedBath = unit.bedrooms && unit.bathrooms 
            ? `${unit.bedrooms} bed/${unit.bathrooms} bath`
            : unit.bedrooms 
              ? `${unit.bedrooms} bed`
              : unit.bathrooms
                ? `${unit.bathrooms} bath`
                : '';
          propertyContext += `${bedBath ? bedBath + ', ' : ''}${prop.address} Apartment Unit ${unit.unitNumber}`;
          if (unit.monthlyRent) propertyContext += ` - $${parseFloat(unit.monthlyRent).toLocaleString()}/month`;
          if (unit.leaseStartDate) propertyContext += ` - Available: ${unit.leaseStartDate}`;
          propertyContext += `\n`;
        });
        if (prop.listedUnits.length > 10) {
          propertyContext += `...and ${prop.listedUnits.length - 10} more available units\n`;
        }
      }
    });
    propertyContext += `\nIMPORTANT: Use only the property and unit information provided above from the database. All units shown above have booking enabled and are available for scheduling. Format responses as: "{bedrooms} bed/{bathrooms} bath, {address} Apartment Unit {unitNumber}". Do not make up details.`;
  }

  // Build leasing rules context - ALWAYS include if qualifications exist
  let leasingRulesContext = '';
  if (qualificationSettings && qualificationSettings.qualifications) {
    // Handle both JSON string and array formats
    let quals: any[] = [];
    if (typeof qualificationSettings.qualifications === 'string') {
      try {
        quals = JSON.parse(qualificationSettings.qualifications);
      } catch (e) {
        console.error('[AI Reply Generator] Error parsing qualifications string:', e);
      }
    } else if (Array.isArray(qualificationSettings.qualifications)) {
      quals = qualificationSettings.qualifications;
    }
    
    console.log(`[AI Reply Generator] Processed qualifications:`, {
      count: quals.length,
      quals: quals
    });
    
    if (quals.length > 0) {
      leasingRulesContext = `\n\nLEASING REQUIREMENTS / QUALIFICATIONS (CRITICAL: Always use these EXACT criteria when asked about qualifications, requirements, or policies):
`;
      quals.forEach((qual: any) => {
        // Skip disabled qualifications
        if (qual.enabled === false) {
          return;
        }
        
        const qualType = (qual.type || '').toLowerCase();
        const config = qual.config || {};
        
        // Handle different qualification types based on the config structure
        if (qualType === 'income') {
          const multiplier = config.incomeMultiplier;
          if (multiplier !== undefined && multiplier !== null) {
            leasingRulesContext += `- Income Requirement: ${multiplier}x monthly rent\n`;
          }
        } else if (qualType === 'credit_score' || qualType === 'credit') {
          const minScore = config.minCreditScore;
          if (minScore !== undefined && minScore !== null) {
            leasingRulesContext += `- Minimum Credit Score: ${minScore}\n`;
          }
        } else if (qualType === 'rental_history') {
          const maxEvictions = config.maxEvictions;
          const minYears = config.minRentalYears;
          if (maxEvictions !== undefined && maxEvictions !== null) {
            leasingRulesContext += `- Maximum Evictions Allowed: ${maxEvictions}\n`;
          }
          if (minYears !== undefined && minYears !== null && minYears > 0) {
            leasingRulesContext += `- Minimum Rental History: ${minYears} ${minYears === 1 ? 'year' : 'years'}\n`;
          }
        } else if (qualType === 'criminal_history') {
          const allowed = config.allowCriminalHistory;
          if (allowed !== undefined && allowed !== null) {
            leasingRulesContext += `- Criminal History: ${allowed ? 'Allowed' : 'Not Allowed'}\n`;
          }
        } else if (qualType === 'employment') {
          const minMonths = config.minEmploymentMonths;
          if (minMonths !== undefined && minMonths !== null && minMonths > 0) {
            leasingRulesContext += `- Minimum Employment: ${minMonths} ${minMonths === 1 ? 'month' : 'months'}\n`;
          }
        } else if (qualType === 'occupants') {
          const maxOccupants = config.maxOccupants;
          if (maxOccupants !== undefined && maxOccupants !== null) {
            leasingRulesContext += `- Maximum Occupants: ${maxOccupants}\n`;
          }
        } else if (qualType === 'pets') {
          const petsAllowed = config.petsAllowed;
          const petFee = config.petFee;
          if (petsAllowed !== undefined && petsAllowed !== null) {
            leasingRulesContext += `- Pets: ${petsAllowed ? 'Allowed' : 'Not Allowed'}`;
            if (petsAllowed && petFee !== undefined && petFee !== null && petFee > 0) {
              leasingRulesContext += ` (Pet Fee: $${petFee})`;
            }
            leasingRulesContext += `\n`;
          }
        } else if (qualType === 'deposit' || qualType === 'security_deposit') {
          const multiplier = config.depositMultiplier;
          const minDeposit = config.minDeposit;
          if (multiplier !== undefined && multiplier !== null && multiplier > 0) {
            leasingRulesContext += `- Security Deposit: ${multiplier}x monthly rent\n`;
          } else if (minDeposit !== undefined && minDeposit !== null && minDeposit > 0) {
            leasingRulesContext += `- Minimum Security Deposit: $${minDeposit.toLocaleString()}\n`;
          }
        } else {
          // Fallback: try to extract value from config or use old format
          const qualValue = qual.value || config.value || config.amount || config.max || config.min || '';
          const qualLabel = qual.label || qual.name || qualType || 'Requirement';
          if (qualValue !== undefined && qualValue !== null && qualValue !== '') {
            leasingRulesContext += `- ${qualLabel}: ${qualValue}\n`;
          }
        }
      });
      const qualificationSource = finalPropertyId && qualificationSettings?.propertyId 
        ? `for ${property?.name || property?.address || 'this property'}`
        : 'for our organization';
      leasingRulesContext += `\n\nCRITICAL INSTRUCTION: When the lead asks about qualifications, requirements, or policies ${finalPropertyId ? 'for a specific property' : ''}, you MUST provide the EXACT information listed above ${qualificationSource}. Use the exact values and wording provided. Do not say things are "undefined" or "not defined" - if a qualification is listed above, it is defined and you must state it exactly as shown.`;
    } else {
      console.log(`[AI Reply Generator] Qualifications array is empty`);
      leasingRulesContext = `\n\nLEASING REQUIREMENTS: No specific qualification requirements have been set for this organization.`;
    }
  } else {
    console.log(`[AI Reply Generator] No qualification settings found`);
    leasingRulesContext = `\n\nLEASING REQUIREMENTS: No specific qualification requirements have been set for this organization.`;
  }

  // Get calendar availability context
  const availabilityContext = await getAvailabilityContext();

  // Build time slots text for prompt
  let timeSlotsText = '';
  if (suggestedTimeSlots.length > 0) {
    timeSlotsText = '\n\nSUGGESTED SHOWING TIMES (AI-optimized for this property - these times are CONFIRMED AVAILABLE based on assigned members\' schedules):';
    suggestedTimeSlots.forEach((slot, idx) => {
      timeSlotsText += `\n${idx + 1}. ${slot.date} at ${slot.time} (Score: ${slot.score}/100 - ${slot.reason})`;
    });
    timeSlotsText += `\n\nPublic Booking Link: ${bookingLink}`;
    timeSlotsText += `\n\n⚠️ CRITICAL: ONLY mention these specific times if the lead asks about scheduling a tour/showing. These are the ONLY confirmed available times based on assigned members' actual availability. Do NOT make up or suggest other times.`;
  } else if (bookingLink) {
    // If booking link exists but no time slots, the property might have availability through the booking system
    // Don't say it's "not available" - just say to use the booking link
    timeSlotsText = `\n\nPublic Booking Link (for self-service scheduling): ${bookingLink}`;
    timeSlotsText += `\n\n⚠️ CRITICAL: While specific time slots are not available in the immediate next 7 days, the property has a booking system enabled. If the lead asks about tours, direct them to use the booking link above to see available times and schedule a showing. Do NOT say tours are "not available" - instead, mention that they can schedule through the booking link.`;
  } else {
    // Only say "not available" if there's no booking link at all
    timeSlotsText = `\n\n⚠️ CRITICAL: This property does NOT have booking enabled or configured. Do NOT suggest any specific tour times or mention scheduling availability. If the lead asks about tours, politely inform them that scheduling is not currently available for this property and offer to help them with other questions.`;
  }

  // Build organization context
  let orgContext = '';
  if (brandVoice) {
    orgContext += `\n- Brand Voice/Tone: ${brandVoice}`;
  }
  if (policies) {
    orgContext += `\n- Organization Policies: ${policies}`;
  }
  if (organization?.email) {
    orgContext += `\n- Organization Email: ${organization.email}`;
  }
  if (organization?.phone) {
    orgContext += `\n- Organization Phone: ${organization.phone}`;
  }
  if (organization?.address) {
    orgContext += `\n- Organization Address: ${organization.address}`;
  }

  // Build conversation context
  let conversationContext = '';
  if (isPracticeMode && conversationHistory.length > 0) {
    // Practice mode: use conversation history
    conversationContext = '\n\nCONVERSATION HISTORY:\n';
    conversationHistory.forEach((msg: any) => {
      const sender = msg.role === 'lead' ? 'Lead' : 'You';
      conversationContext += `${sender}: ${msg.message}\n`;
    });
  } else if (conversations && conversations.length > 0) {
    // Real mode: use conversation analysis
    const { buildConversationContext, analyzeConversation } = await import("./conversationIntelligence");
    const conversationAnalysis = await analyzeConversation(
      conversations.map((c: any) => ({
        type: c.type,
        message: c.message,
        createdAt: c.createdAt,
        channel: c.channel,
      })),
      openai
    );
    conversationContext = buildConversationContext(
      conversations.map((c: any) => ({
        type: c.type,
        message: c.message,
        createdAt: c.createdAt,
        channel: c.channel,
      })),
      conversationAnalysis
    );
  }

  // Build personality/tone instructions
  let personalityInstructions = '';
  if (friendliness === 'friendly') {
    personalityInstructions += 'Write in a warm, approachable, and friendly tone. Use casual language and show enthusiasm. ';
  } else {
    personalityInstructions += 'Write in a professional and businesslike tone. Maintain a respectful and courteous demeanor. ';
  }
  if (formality === 'conversational') {
    personalityInstructions += 'Use conversational language with contractions and a more relaxed style. ';
  } else {
    personalityInstructions += 'Use formal language with proper grammar and structure. Avoid contractions. ';
  }
  if (responseLength === 'one-paragraph') {
    personalityInstructions += 'CRITICAL: Your response MUST be exactly ONE paragraph only. Do not use multiple paragraphs, bullet points, or line breaks. Write everything in a single, flowing paragraph. Be extremely concise and direct. ';
  } else if (responseLength === 'short') {
    personalityInstructions += 'Keep responses concise (2-3 short paragraphs maximum). Get to the point quickly. ';
  } else {
    personalityInstructions += 'Provide detailed, thorough responses (3-4 paragraphs). Include comprehensive information. ';
  }
  if (urgency === 'high') {
    personalityInstructions += 'Create a sense of urgency and timeliness. Encourage quick action. Use phrases like "limited availability" or "act soon". ';
  } else if (urgency === 'low') {
    personalityInstructions += 'Maintain a relaxed, no-pressure approach. Avoid creating urgency. ';
  } else {
    personalityInstructions += 'Balance urgency with professionalism. Mention availability naturally without being pushy. ';
  }
  if (warmth === 'high') {
    personalityInstructions += 'Show genuine warmth and care. Use empathetic language and show personal interest. ';
  } else if (warmth === 'low') {
    personalityInstructions += 'Keep responses factual and straightforward. Maintain professional distance. ';
  } else {
    personalityInstructions += 'Show appropriate warmth while remaining professional. Be personable but not overly casual. ';
  }
  if (communicationStyle === 'sales-assist') {
    personalityInstructions += 'Adopt a sales-assist approach: highlight benefits, create excitement, guide toward application/showing, and overcome objections. ';
  } else {
    personalityInstructions += 'Adopt an informational approach: provide clear information, answer questions thoroughly, and let the lead decide without pressure. ';
  }

  // Build lead information section
  let leadInfoSection = '';
  if (lead) {
    leadInfoSection = `\n\nLEAD INFORMATION:
- Name: ${lead.name}
${lead.propertyName ? `- Property: ${lead.propertyName}` : ''}
${lead.moveInDate ? `- Move-in Date: ${lead.moveInDate}` : ''}
${leadNotes.length > 0 ? `\nPrevious Notes:\n${leadNotes.slice(-5).map((note: any) => `  • ${note.content}`).join('\n')}` : ''}`;
  }

  // Build your information section
  let yourInfoSection = '';
  if (orgContext || userName || orgName || userEmail) {
    yourInfoSection = `\n\nYOUR INFORMATION:\n- Your Name: ${userName}\n- Organization: ${orgName}${userEmail ? `\n- Email: ${userEmail}` : ''}${orgContext}`;
  }

  // Build the prompt
  const replyPrompt = `${trainingContent ? `${trainingContent}

` : ''}${correctionsContext}${personalityInstructions ? `\n\nPERSONALITY/TONE GUIDELINES:\n${personalityInstructions}\n` : ''}Respond to this lead's message using the communication style and approach from the training content above. ${correctionsContext ? 'Pay special attention to the corrected examples - follow that style.' : ''} If no training content is provided, respond naturally and professionally.

LEAD'S MESSAGE:
${leadMessage}
${leadInfoSection}
${propertyContext}${leasingRulesContext}${availabilityContext}${timeSlotsText}${conversationContext}${yourInfoSection}

${propertyNotFoundWarning}
${property ? `IMPORTANT: Use only the property information provided above. Do not make up details.` : ''}
${!property && propertyMention && !matchedProperty ? `\n\n⚠️ CRITICAL TRUTH REQUIREMENT: The lead asked about "${propertyMention}" but this property/address/unit does NOT exist in your database/portfolio. You MUST:
- Tell them you don't have that property/address/unit in your portfolio
- DO NOT confirm it is available
- DO NOT provide any details about it (rent, qualifications, availability, etc.)
- DO NOT make up information about it
- Offer to help them find available properties from your actual listings instead
- Only mention properties/units that are listed in the property context above` : ''}
${property && propertyUnits.length > 0 ? `\n\n⚠️ CRITICAL: This property HAS available units listed above. You CAN confirm availability for this property. Only mention the specific units listed above.` : ''}
${property && propertyUnits.length === 0 ? `\n\n⚠️ CRITICAL: This property has NO available units. DO NOT confirm this property is available. If asked about availability, inform the lead that this property does not currently have any available units.` : ''}
${propertyUnits.length > 0 ? `IMPORTANT: Use only the unit information provided above. Do not make up rent amounts or unit details.` : ''}
${leasingRulesContext ? `\nCRITICAL: When the lead asks about qualifications, requirements, policies, or what is needed to rent, you MUST provide the exact qualification requirements listed above. Do not make up or guess qualification requirements.` : ''}
${responseLength === 'one-paragraph' ? `\n\nCRITICAL RESPONSE LENGTH REQUIREMENT: Your response MUST be exactly ONE paragraph. Do NOT use multiple paragraphs, bullet points, numbered lists, or line breaks. Write everything in a single, continuous paragraph. If you need to mention multiple items (like qualifications or time slots), combine them into one flowing paragraph using connecting words like "and", "also", "additionally". Keep it brief and direct.` : ''}

Write a response following the training content style. Do not include a signature.`;

  // Generate AI reply
  const systemMessage = responseLength === 'one-paragraph' 
    ? "You are a leasing agent assistant. CRITICAL: When responding, you MUST write in exactly ONE paragraph only. Never use multiple paragraphs, bullet points, numbered lists, or line breaks. Combine all information into a single, flowing paragraph."
    : undefined;
  
  const messages = systemMessage 
    ? [
        { role: "system" as const, content: systemMessage },
        { role: "user" as const, content: replyPrompt }
      ]
    : [{ role: "user" as const, content: replyPrompt }];
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    temperature: 0.7,
    ...(responseLength === 'one-paragraph' ? { max_tokens: 200 } : {}), // Limit tokens for 1-paragraph responses
  });

  return completion.choices[0].message.content || "";
}

