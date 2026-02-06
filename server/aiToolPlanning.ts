/**
 * Tool Planning and Sanity Checks
 * 
 * Implements tool planning (decide which tools and parameters before calling)
 * and tool result sanity checks to catch common failure modes.
 */

import { ToolResult } from "./aiTools";

export interface ToolPlan {
  toolName: string;
  args: Record<string, any>;
  reason: string;
  required: boolean;
}

/**
 * Plan which tools to call based on intent and context
 * Avoids calling multiple tools "just in case"
 */
export function planToolCalls(
  intent: string,
  context: {
    propertyId?: string | null;
    unitId?: string | null;
    leadId?: string | null;
    leadMessage?: string;
  }
): ToolPlan[] {
  const plans: ToolPlan[] = [];

  switch (intent) {
    case 'availability':
      if (context.propertyId) {
        plans.push({
          toolName: 'get_availability',
          args: { propertyId: context.propertyId },
          reason: 'Check availability for specific property',
          required: true
        });
      } else {
        plans.push({
          toolName: 'get_availability',
          args: {},
          reason: 'Check availability across all properties',
          required: true
        });
      }
      break;

    case 'pricing':
      if (context.unitId) {
        plans.push({
          toolName: 'quote_price',
          args: { unitId: context.unitId },
          reason: 'Get pricing for specific unit',
          required: true
        });
      } else if (context.propertyId) {
        // Need unit first - will be handled by unit detection
        plans.push({
          toolName: 'list_portfolio_units',
          args: { propertyId: context.propertyId },
          reason: 'List units to identify which one for pricing',
          required: false
        });
      } else {
        plans.push({
          toolName: 'list_portfolio_units',
          args: {},
          reason: 'List all units to identify which one for pricing',
          required: false
        });
      }
      break;

    case 'scheduling':
    case 'tour_booking':
      if (context.propertyId) {
        plans.push({
          toolName: 'get_tour_slots',
          args: { 
            propertyId: context.propertyId,
            unitId: context.unitId || undefined
          },
          reason: intent === 'tour_booking' ? 'Get slots for in-chat booking' : 'Get available tour slots for property',
          required: true
        });
      } else {
        // If no propertyId in context, this is likely a follow-up question
        // The AI should use memory to determine which property
        // Don't add a tool plan here - let the AI handle it with a follow-up question
        // This prevents premature tool calls without proper context
      }
      break;

    case 'qualifications':
      plans.push({
        toolName: 'get_qualifications',
        args: { propertyId: context.propertyId || undefined },
        reason: 'Get qualification requirements',
        required: true
      });
      break;

    case 'portfolio_units':
      plans.push({
        toolName: 'list_portfolio_units',
        args: { propertyId: context.propertyId || undefined },
        reason: 'List all properties and units in portfolio',
        required: true
      });
      break;

    case 'application_status':
      if (context.leadId) {
        plans.push({
          toolName: 'get_application_status',
          args: { leadId: context.leadId },
          reason: 'Get application status for lead',
          required: true
        });
      }
      break;

    case 'contact_info':
      plans.push({
        toolName: 'get_property_contact_info',
        args: {
          propertyId: context.propertyId || undefined,
          unitId: context.unitId || undefined
        },
        reason: 'Get company name and assigned leasing agent(s) for property',
        required: true
      });
      break;

    case 'neighborhood':
      if (context.propertyId) {
        plans.push({
          toolName: 'get_nearby_places_openai',
          args: {
            propertyId: context.propertyId,
            radiusMeters: 800,
            categories: ['grocery', 'coffee', 'restaurants', 'pharmacy', 'parks', 'transit', 'gym']
          },
          reason: 'Search for nearby places around the property',
          required: true
        });
      }
      break;
  }

  return plans;
}

/**
 * Sanity check tool results to catch common failure modes
 */
export interface SanityCheckResult {
  passed: boolean;
  warning?: string;
  shouldEscalate?: boolean;
  followUpQuestion?: string;
}

export function sanityCheckToolResult(
  toolName: string,
  result: ToolResult,
  context: {
    propertyId?: string | null;
    unitId?: string | null;
    intent?: string;
  }
): SanityCheckResult {
  if (!result.success) {
    return {
      passed: false,
      warning: `Tool ${toolName} failed: ${result.error}`,
      shouldEscalate: true
    };
  }

  switch (toolName) {
    case 'get_availability':
      const data = result.data;
      if (data) {
        // If property exists but 0 units returned, might need unit selection
        if (context.propertyId && data.availableUnits && Array.isArray(data.availableUnits) && data.availableUnits.length === 0) {
          // Check if property actually has units
          if (data.totalUnits > 0) {
            return {
              passed: true,
              warning: 'Property has units but none are available/listed',
              followUpQuestion: 'Which unit are you interested in? I can check specific availability.'
            };
          }
        }
        
        // If no properties at all, this is valid data
        if (!data.properties || (Array.isArray(data.properties) && data.properties.length === 0)) {
          return {
            passed: true,
            warning: 'No available properties found - this is valid data, not an error'
          };
        }
      }
      break;

    case 'quote_price':
      if (result.data) {
        const hasRent = result.data.monthlyRent !== null && result.data.monthlyRent !== undefined;
        const hasDeposit = result.data.deposit !== null && result.data.deposit !== undefined;
        
        if (!hasRent) {
          return {
            passed: false,
            warning: 'Pricing tool returned no rent information',
            shouldEscalate: true,
            followUpQuestion: 'I need to get the current rent information. Would you like me to connect you with our leasing office?'
          };
        }
        
        if (!hasDeposit) {
          return {
            passed: true,
            warning: 'Pricing tool missing deposit information - answer with what we have',
            shouldEscalate: false
          };
        }
      }
      break;

    case 'get_tour_slots':
      if (result.data) {
        const hasSlots = result.data.availableSlots && Array.isArray(result.data.availableSlots) && result.data.availableSlots.length > 0;
        if (!hasSlots) {
          return {
            passed: true,
            warning: 'No tour slots available - this is valid data',
            followUpQuestion: 'I don\'t see any available tour slots right now. Would you like me to check back later or connect you with our leasing office?'
          };
        }
      }
      break;

    case 'get_qualifications':
      if (result.data && result.data.qualifications && Array.isArray(result.data.qualifications) && result.data.qualifications.length === 0) {
        return {
          passed: true,
          warning: 'No qualification requirements found - this is valid data'
        };
      }
      break;

    case 'get_nearby_places_openai':
      if (result.data?.partial) {
        return {
          passed: true,
          warning: 'Nearby places search returned partial or limited results'
        };
      }
      break;
  }

  return { passed: true };
}

/**
 * Detect unit from message text after routing
 * Used when intent requires unitId but we don't have it yet
 */
export function detectUnitFromMessage(
  message: string,
  availableUnits: Array<{
    unitId: string;
    unitNumber: string;
    bedrooms: number;
    bathrooms: string;
  }>
): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Try to match unit number
  for (const unit of availableUnits) {
    const unitNumLower = unit.unitNumber.toLowerCase();
    if (lowerMessage.includes(unitNumLower) || lowerMessage.includes(`unit ${unitNumLower}`)) {
      return unit.unitId;
    }
  }
  
  // Try to match bedrooms
  const bedMatch = lowerMessage.match(/(\d+)\s*(?:bed|br|bedroom|bedrooms)/);
  if (bedMatch) {
    const beds = parseInt(bedMatch[1]);
    const matchingUnits = availableUnits.filter(u => u.bedrooms === beds);
    if (matchingUnits.length === 1) {
      return matchingUnits[0].unitId;
    }
  }
  
  // Try to match bathrooms
  const bathMatch = lowerMessage.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom|bathrooms)/);
  if (bathMatch) {
    const baths = parseFloat(bathMatch[1]);
    const matchingUnits = availableUnits.filter(u => {
      const unitBaths = parseFloat(u.bathrooms);
      return Math.abs(unitBaths - baths) < 0.5;
    });
    if (matchingUnits.length === 1) {
      return matchingUnits[0].unitId;
    }
  }
  
  // Try "studio", "1 bed", "2 bed", etc.
  if (lowerMessage.includes('studio')) {
    const studios = availableUnits.filter(u => u.bedrooms === 0);
    if (studios.length === 1) {
      return studios[0].unitId;
    }
  }
  
  return null;
}

