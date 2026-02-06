import crypto from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { bookingIdempotency } from "@shared/schema";
import { suggestTimeSlots } from "./ai-scheduling";
import { getPropertyLocation, getNearbyPlacesOpenAI } from "./aiNeighborhoodTools";
import { getBaseUrlForBookingLink } from "./domainConfig";
import { eq, and } from "drizzle-orm";

/**
 * Tool definitions for AI Leasing Agent function calling
 * These tools provide real-time, authoritative data (Lane B - fast-changing truth)
 * Never RAG this data - always fetch from database/calendar at runtime
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  sources?: string[];
}

/**
 * Get real-time availability for a property
 */
export async function getAvailability(
  orgId: string,
  propertyId?: string,
  unitId?: string,
  dates?: { start: string; end: string }
): Promise<ToolResult> {
  try {
    if (!propertyId) {
      // Get all properties with listed units
      const properties = await storage.getPropertiesWithListedUnits(orgId, { includeAll: false });
      console.log(`[getAvailability] Found ${properties.length} properties with listed units`);
      
      // Debug: Log details about each property and its units
      for (const prop of properties) {
        console.log(`[getAvailability] Property "${prop.name}" (${prop.id}):`);
        console.log(`  - Total listedUnits: ${prop.listedUnits.length}`);
        
        for (const unit of prop.listedUnits) {
          const hasBookingSettings = unit.customEventName !== null || 
                                    unit.customBookingMode !== null || 
                                    unit.customEventDuration !== null;
          const isListedOrBookable = unit.isListed === true || hasBookingSettings;
          // For availability questions, only check if listed (not booking enabled)
          const passesAll = isListedOrBookable;
          
          const checks = {
            isListed: unit.isListed,
            hasBookingSettings,
            isListedOrBookable,
            bookingEnabled: unit.bookingEnabled,
            passesAll
          };
          console.log(`  - Unit ${unit.unitNumber || unit.id}:`, checks);
          
          if (!checks.passesAll) {
            const reasons = [];
            if (!checks.isListed && !checks.hasBookingSettings) reasons.push('not listed and no booking settings');
            if (!checks.bookingEnabled && !checks.hasBookingSettings) reasons.push('booking disabled and no booking settings');
            console.log(`    ❌ Filtered out because: ${reasons.join(', ')}`);
          } else {
            console.log(`    ✅ Passes all filters (occupancy status is not checked)`);
          }
        }
      }
      
      const availableProperties = properties
        .map(prop => ({
          ...prop,
          listedUnits: prop.listedUnits.filter((unit: any) => {
            // A unit is "available" (for inquiries/information) if:
            // 1. It's listed (isListed === true) OR has custom booking settings
            // NOTE: Occupancy status is NOT checked - listed units are considered available regardless of occupancy
            // NOTE: Booking enabled is NOT required for availability questions - only for tour questions
            
            const hasBookingSettings = unit.customEventName !== null || 
                                      unit.customBookingMode !== null || 
                                      unit.customEventDuration !== null;
            
            const isListedOrBookable = unit.isListed === true || hasBookingSettings;
            
            const passes = isListedOrBookable;
            
            if (!passes) {
              console.log(`    ❌ Unit ${unit.unitNumber || unit.id} filtered:`, {
                isListed: unit.isListed,
                hasBookingSettings,
                isListedOrBookable,
                bookingEnabled: unit.bookingEnabled
              });
            }
            
            return passes;
          })
        }))
        .filter(prop => prop.listedUnits.length > 0);
      
      console.log(`[getAvailability] Found ${availableProperties.length} properties with available units (out of ${properties.length} total properties)`);
      
      // Return success even if no properties found - this is valid data
      const result = {
        success: true,
        data: {
          properties: availableProperties.length > 0 
            ? availableProperties.map(prop => ({
                propertyId: prop.id,
                propertyName: prop.name,
                address: prop.address,
                availableUnits: prop.listedUnits.map((unit: any) => ({
                  unitId: unit.id,
                  unitNumber: unit.unitNumber,
                  bedrooms: unit.bedrooms,
                  bathrooms: unit.bathrooms,
                  monthlyRent: unit.monthlyRent,
                  leaseStartDate: unit.leaseStartDate,
                  status: unit.status
                }))
              }))
            : [],
          hasAvailableUnits: availableProperties.length > 0,
          totalProperties: properties.length,
          message: availableProperties.length === 0 
            ? "No available units found in portfolio. All units are not listed."
            : `Found ${availableProperties.length} property/properties with available units.`
        },
        sources: ['database:property_units']
      };
      
      console.log(`[getAvailability] Returning:`, JSON.stringify(result.data).substring(0, 200));
      return result;
    }

    // Get specific property
    const property = await storage.getProperty(propertyId, orgId);
    if (!property) {
      return {
        success: false,
        error: `Property ${propertyId} not found`,
        sources: ['database:properties']
      };
    }

    const allUnits = await storage.getAllUnitsByProperty(propertyId, orgId);
    console.log(`[getAvailability] Found ${allUnits.length} total units for property ${propertyId}`);
    console.log(`[getAvailability] Property details:`, { id: property.id, name: property.name, address: property.address });
    
    // Get property scheduling settings to check for custom booking settings
    const propertySettings = await storage.getPropertySchedulingSettings(propertyId, orgId);
    
    const availableUnits = allUnits.filter(unit => {
      // Check if unit has custom booking settings
      const hasBookingSettings = unit.customEventName !== null || 
                                unit.customBookingMode !== null || 
                                unit.customEventDuration !== null ||
                                (propertySettings && propertySettings.eventName !== null);
      
      // A unit is "available" (for inquiries/information) if:
      // 1. It's listed (isListed === true) OR has custom booking settings
      // NOTE: Occupancy status is NOT checked - listed units are considered available regardless of occupancy
      // NOTE: Booking enabled is NOT required for availability questions - only for tour questions
      const isListedOrBookable = unit.isListed === true || hasBookingSettings;
      
      const passes = isListedOrBookable &&
                    (!unitId || unit.id === unitId);
      
      if (!passes && (!unitId || unit.id === unitId)) {
        console.log(`[getAvailability] Unit ${unit.unitNumber || unit.id} filtered:`, {
          isListed: unit.isListed,
          hasBookingSettings,
          isListedOrBookable,
          bookingEnabled: unit.bookingEnabled,
          hasBookingEnabled,
          passes
        });
      }
      
      return passes;
    });

    console.log(`[getAvailability] Found ${availableUnits.length} available units for property ${propertyId} (out of ${allUnits.length} total units)`);

    const result = {
      success: true,
      data: {
        propertyId: property.id,
        propertyName: property.name,
        address: property.address,
        availableUnits: availableUnits.map(unit => ({
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          monthlyRent: unit.monthlyRent,
          leaseStartDate: unit.leaseStartDate,
          status: unit.status
        })),
        hasAvailableUnits: availableUnits.length > 0,
        totalUnits: allUnits.length,
        message: availableUnits.length === 0
          ? `No available units found for ${property.name}. All units are not listed.`
          : `Found ${availableUnits.length} available unit(s) for ${property.name}.`
      },
      sources: ['database:property_units']
    };
    
    console.log(`[getAvailability] Returning:`, JSON.stringify(result.data).substring(0, 200));
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get availability',
      sources: ['database:property_units']
    };
  }
}

/**
 * Get pricing information for a unit
 */
export async function quotePrice(
  orgId: string,
  unitId: string,
  moveInDate?: string
): Promise<ToolResult> {
  try {
    const unit = await storage.getPropertyUnit(unitId, orgId);
    if (!unit) {
      return {
        success: false,
        error: `Unit ${unitId} not found`,
        sources: ['database:property_units']
      };
    }

    const property = await storage.getProperty(unit.propertyId, orgId);
    
    // Get qualification settings for deposit calculation
    const qualificationSettings = await storage.getPropertyQualificationSettings(unit.propertyId, orgId) ||
                                  await storage.getOrgQualificationSettings(orgId);

    return {
      success: true,
      data: {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        propertyId: property?.id,
        propertyName: property?.name,
        address: property?.address,
        monthlyRent: unit.monthlyRent,
        deposit: unit.deposit || qualificationSettings?.qualifications?.find((q: any) => q.type === 'deposit')?.value,
        leaseStartDate: unit.leaseStartDate,
        moveInDate: moveInDate || unit.leaseStartDate,
        fees: {
          applicationFee: qualificationSettings?.qualifications?.find((q: any) => q.type === 'application_fee')?.value,
          petFee: qualificationSettings?.qualifications?.find((q: any) => q.type === 'pet_fee')?.value,
        }
      },
      sources: ['database:property_units', 'database:qualification_settings']
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get pricing',
      sources: ['database:property_units']
    };
  }
}

/**
 * Get available tour/showing slots
 */
export async function getTourSlots(
  orgId: string,
  propertyId: string,
  unitId?: string,
  preferredTimes?: string[]
): Promise<ToolResult> {
  try {
    const property = await storage.getProperty(propertyId, orgId);
    if (!property) {
      return {
        success: false,
        error: `Property ${propertyId} not found`,
        sources: ['database:properties']
      };
    }

    // For tours, we need to verify units are listed AND booking enabled
    // Occupancy status does NOT matter - as long as it's listed and booking enabled, tours are available
    if (unitId) {
      const unit = await storage.getPropertyUnit(unitId, orgId);
      if (!unit) {
        return {
          success: false,
          error: `Unit ${unitId} not found`,
          sources: ['database:property_units']
        };
      }
      
      // Check if unit is listed
      const hasBookingSettings = unit.customEventName !== null || 
                                unit.customBookingMode !== null || 
                                unit.customEventDuration !== null;
      const isListed = unit.isListed === true || hasBookingSettings;
      
      if (!isListed) {
        return {
          success: false,
          error: `Unit ${unit.unitNumber || unitId} is not listed and cannot be booked for tours`,
          sources: ['database:property_units']
        };
      }
      
      // Check if booking is enabled
      const bookingEnabled = unit.bookingEnabled === true || hasBookingSettings;
      if (!bookingEnabled) {
        return {
          success: false,
          error: `Unit ${unit.unitNumber || unitId} does not have booking enabled for tours`,
          sources: ['database:property_units']
        };
      }
    } else {
      // If no unitId, check if property has any listed units with booking enabled
      const allUnits = await storage.getAllUnitsByProperty(propertyId, orgId);
      const bookableUnits = allUnits.filter(unit => {
        const hasBookingSettings = unit.customEventName !== null || 
                                  unit.customBookingMode !== null || 
                                  unit.customEventDuration !== null;
        const isListed = unit.isListed === true || hasBookingSettings;
        const bookingEnabled = unit.bookingEnabled === true || hasBookingSettings;
        return isListed && bookingEnabled;
      });
      
      if (bookableUnits.length === 0) {
        return {
          success: false,
          error: `No units at ${property.name} are listed with booking enabled for tours`,
          sources: ['database:property_units']
        };
      }
    }

    // Get property scheduling settings
    const propertySettings = await storage.getPropertySchedulingSettings(propertyId, orgId);
    
    // Get unit settings if unitId provided
    let unitSettings = null;
    if (unitId) {
      unitSettings = await storage.getUnitSchedulingSettings(unitId, orgId);
    }

    // Merge settings (unit overrides property)
    const effectiveSettings = unitSettings ? {
      ...propertySettings,
      assignedMembers: unitSettings.customAssignedMembers || propertySettings?.assignedMembers,
      eventDuration: unitSettings.customEventDuration ?? propertySettings?.eventDuration,
      bufferTime: unitSettings.customBufferTime ?? propertySettings?.bufferTime,
      leadTime: unitSettings.customLeadTime ?? propertySettings?.leadTime,
    } : propertySettings;

    // Get showings for next 30 days (was 7 days - increased to show multiple weeks of availability)
    // This allows users to see availability beyond just the current week (e.g., Feb 2, Feb 9, Feb 16, etc.)
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const allShowings = await storage.getShowingsByDateRange(startDate, endDate, orgId);

    // Get schedule preferences FOR THIS PROPERTY (and unit if applicable) only.
    // Using getSchedulePreferences() without propertyId would include other properties'
    // days (e.g. Friday at another property), causing wrong slots and AI saying wrong days.
    let schedulePrefs: Awaited<ReturnType<typeof storage.getSchedulePreferencesForUsers>>;
    const assignedMemberIds = effectiveSettings?.assignedMembers && Array.isArray(effectiveSettings.assignedMembers)
      ? effectiveSettings.assignedMembers.map((m: any) => typeof m === 'string' ? m : (m?.userId || m)).filter(Boolean)
      : [];
    if (assignedMemberIds.length > 0) {
      schedulePrefs = await storage.getSchedulePreferencesForUsers(assignedMemberIds, propertyId, unitId ?? undefined);
    } else {
      // No assigned members: use all org prefs for this property only
      const allPrefs = await storage.getSchedulePreferences(undefined, propertyId);
      schedulePrefs = allPrefs;
    }

    // Get unique days of week that have schedule preferences (for this property/unit only)
    const daysWithPreferences = new Set<string>();
    schedulePrefs.forEach(pref => {
      if (pref.dayOfWeek) {
        daysWithPreferences.add(pref.dayOfWeek.toLowerCase());
      }
    });

    // Get all properties for route optimization
    const allPropertiesArray = await storage.getAllProperties(orgId);
    const allPropertiesMap = new Map(allPropertiesArray.map(p => [p.id, p]));

    // Generate time slots only for days that have schedule preferences
    // Loop through next 30 days (was 7 days - increased to show multiple weeks)
    const allSuggestions: any[] = [];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let daysAhead = 0; daysAhead < 30; daysAhead++) {
      const targetDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayOfWeek = dayNames[targetDate.getDay()];
      
      // Only process days that have schedule preferences
      if (!daysWithPreferences.has(dayOfWeek)) {
        continue;
      }
      
      const daySuggestions = suggestTimeSlots(
        dateStr,
        property,
        allShowings,
        schedulePrefs,
        allPropertiesMap,
        effectiveSettings as any,
        unitId
      );
      
      // Boost scores for preferred times if provided
      if (preferredTimes && daySuggestions.length > 0) {
        daySuggestions.forEach(slot => {
          slot.score += 10; // Boost for preferred times
        });
      }
      
      allSuggestions.push(...daySuggestions);
    }

    // Sort by date first, then by time, then by score
    // This groups slots by date so we show multiple dates (Feb 2, Feb 9, Feb 16, etc.)
    // Take top 30 slots to show several dates worth of availability
    const topSlots = allSuggestions
      .filter(slot => slot.score > 0)
      .sort((a, b) => {
        // Sort by date first (earlier dates first)
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        // Then by time (earlier times first)
        if (a.time !== b.time) return a.time.localeCompare(b.time);
        // Finally by score (higher scores first)
        return b.score - a.score;
      })
      .slice(0, 30); // Increased from 15 to show multiple dates

    // Generate booking link - use environment-appropriate domain (localhost in dev, canonical in prod)
    const baseUrl = getBaseUrlForBookingLink();
    const bookingLink = `${baseUrl}/book-showing/property/${propertyId}`;

    // Extract scheduling settings for AI context
    const schedulingInfo = {
      eventDuration: effectiveSettings?.eventDuration || 30,
      bufferTime: effectiveSettings?.bufferTime || 15,
      leadTime: effectiveSettings?.leadTime || 60,
      assignedMembers: effectiveSettings?.assignedMembers || [],
      availableDays: Array.from(daysWithPreferences),
      totalPreferences: schedulePrefs.length
    };

    // slotId format: YYYY-MM-DD_HH:MM for stable selection in chat booking
    return {
      success: true,
      data: {
        propertyId: property.id,
        propertyName: property.name,
        availableSlots: topSlots.map(slot => ({
          slotId: `${slot.date}_${slot.time}`,
          date: slot.date,
          time: slot.time,
          score: slot.score,
          reason: slot.reason
        })),
        bookingLink,
        hasSlots: topSlots.length > 0,
        schedulingInfo: schedulingInfo
      },
      sources: ['database:showings', 'database:schedule_preferences', 'ai-scheduling']
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get tour slots',
      sources: ['database:showings']
    };
  }
}

/**
 * List all properties and units in the portfolio
 */
export async function listPortfolioUnits(
  orgId: string,
  propertyId?: string
): Promise<ToolResult> {
  try {
    if (propertyId) {
      // Get specific property and its units
      const property = await storage.getProperty(propertyId, orgId);
      if (!property) {
        return {
          success: false,
          error: `Property ${propertyId} not found`,
          sources: ['database:properties']
        };
      }

      const units = await storage.getAllUnitsByProperty(propertyId, orgId);
      
      return {
        success: true,
        data: {
          properties: [{
            propertyId: property.id,
            name: property.name,
            address: property.address
          }],
          units: units.map(unit => ({
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            monthlyRent: unit.monthlyRent,
            isListed: unit.isListed,
            status: unit.status
          }))
        },
        sources: ['database:properties', 'database:property_units']
      };
    } else {
      // Get all properties and their units
      const properties = await storage.getAllProperties(orgId);
      
      const propertiesWithUnits = await Promise.all(
        properties.map(async (property) => {
          const units = await storage.getAllUnitsByProperty(property.id, orgId);
          return {
            propertyId: property.id,
            name: property.name,
            address: property.address,
            units: units.map(unit => ({
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              monthlyRent: unit.monthlyRent,
              isListed: unit.isListed,
              status: unit.status
            }))
          };
        })
      );
      
      return {
        success: true,
        data: {
          properties: propertiesWithUnits.map(p => ({
            propertyId: p.propertyId,
            name: p.name,
            address: p.address
          })),
          units: propertiesWithUnits.flatMap(p => p.units)
        },
        sources: ['database:properties', 'database:property_units']
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list portfolio units',
      sources: ['database:properties']
    };
  }
}

/**
 * Upsert lead contact details (name, email, phone).
 * Only updates provided fields. Returns canonical status.
 */
export async function upsertLeadContact(
  orgId: string,
  leadId: string,
  name?: string,
  email?: string,
  phone?: string
): Promise<ToolResult> {
  try {
    const lead = await storage.getLead(leadId, orgId);
    if (!lead) {
      return { success: false, error: 'Lead not found', sources: ['database:leads'] };
    }
    const updates: Record<string, string> = {};
    if (name !== undefined && name?.trim()) updates.name = name.trim();
    if (email !== undefined && email?.trim()) updates.email = email.trim();
    if (phone !== undefined && phone?.trim()) updates.phone = phone.trim();
    if (Object.keys(updates).length > 0) {
      await storage.updateLead(leadId, updates, orgId);
    }
    const updated = await storage.getLead(leadId, orgId);
    const result = {
      name: updated?.name || undefined,
      email: updated?.email || undefined,
      phone: updated?.phone || undefined,
      missing: [] as string[],
    };
    if (!result.name) result.missing.push('name');
    if (!result.email) result.missing.push('email');
    if (!result.phone) result.missing.push('phone');
    return {
      success: true,
      data: result,
      sources: ['database:leads'],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to upsert lead contact',
      sources: ['database:leads'],
    };
  }
}

/**
 * Create tour booking. Idempotent via idempotencyKey.
 */
export async function createTourBooking(
  orgId: string,
  leadId: string,
  args: {
    propertyId: string;
    unitId?: string;
    slotId: string; // YYYY-MM-DD_HH:MM
    contact: { name: string; email: string; phone: string };
    idempotencyKey: string;
  }
): Promise<ToolResult> {
  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  try {
    // Parse slotId -> date, time
    const [date, time] = args.slotId.split('_');
    if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return {
        success: false,
        error: `Invalid slotId format: expected YYYY-MM-DD_HH:MM, got ${args.slotId}`,
        sources: [],
      };
    }

    // Idempotency: return existing booking if key exists
    const existing = await db.select().from(bookingIdempotency).where(eq(bookingIdempotency.idempotencyKey, args.idempotencyKey)).limit(1);
    if (existing.length > 0 && existing[0].showingId) {
      const showing = await storage.getShowing(existing[0].showingId, orgId);
      if (showing) {
        const property = await storage.getProperty(showing.propertyId, orgId);
        const baseUrl = getBaseUrlForBookingLink();
        const rescheduleUrl = `${baseUrl}/book-showing/property/${showing.propertyId}?reschedule=${showing.id}`;
        return {
          success: true,
          data: {
            bookingId: showing.id,
            startTimeISO: `${showing.scheduledDate}T${showing.scheduledTime}:00`,
            endTimeISO: null,
            timezone: property?.timezone || 'America/Chicago',
            locationText: property?.address,
            instructions: null,
            rescheduleUrl,
            idempotent: true,
          },
          sources: ['database:showings'],
        };
      }
    }

    const property = await storage.getProperty(args.propertyId, orgId);
    if (!property) {
      return { success: false, error: 'Property not found', sources: ['database:properties'] };
    }
    const lead = await storage.getLead(leadId, orgId);
    if (!lead) {
      return { success: false, error: 'Lead not found', sources: ['database:leads'] };
    }

    const propertySettings = await storage.getPropertySchedulingSettings(args.propertyId, orgId);
    const effectiveDuration = propertySettings?.eventDuration ?? 30;
    const eventName = propertySettings?.eventName || `Showing for ${property.name}`;
    const locationParts = [property.address, property.city, property.state, property.zipCode].filter(Boolean);
    const location = locationParts.join(', ');

    // Assign to first available member if any
    let assignedTo: string | null = null;
    const members = (propertySettings?.assignedMembers as Array<{ userId?: string; priority?: number }>) || [];
    if (members.length > 0) {
      const userIds = members.map((m: any) => m?.userId || m).filter(Boolean);
      const allShowings = await storage.getShowingsByDateRange(date, date, orgId);
      const conflictTimes = new Set(allShowings.filter(s => s.status !== 'cancelled' && s.status !== 'no_show').map(s => s.scheduledTime));
      for (const uid of userIds) {
        if (!conflictTimes.has(time)) {
          assignedTo = uid;
          break;
        }
      }
    }

    const showing = await storage.createShowing({
      orgId,
      propertyId: args.propertyId,
      unitId: args.unitId || null,
      leadId,
      title: eventName,
      scheduledDate: date,
      scheduledTime: time,
      durationMinutes: effectiveDuration,
      showingType: 'in_person',
      status: 'confirmed',
      location,
      assignedTo: assignedTo,
      aiScheduled: true,
      attendees: [{ name: args.contact.name, email: args.contact.email, phone: args.contact.phone }],
    } as any);

    try {
      await db.insert(bookingIdempotency).values({
        idempotencyKey: args.idempotencyKey,
        leadId,
        orgId,
        showingId: showing.id,
      });
    } catch (idemErr: any) {
      if (idemErr.code === '23505') {
        // Duplicate key - another request may have inserted; re-check and return existing
        const existing = await db.select().from(bookingIdempotency).where(eq(bookingIdempotency.idempotencyKey, args.idempotencyKey)).limit(1);
        if (existing[0]?.showingId) {
          const existingShowing = await storage.getShowing(existing[0].showingId, orgId);
          if (existingShowing) {
            const baseUrl = getBaseUrlForBookingLink();
            return {
              success: true,
              data: {
                bookingId: existingShowing.id,
                startTimeISO: `${existingShowing.scheduledDate}T${existingShowing.scheduledTime}:00`,
                endTimeISO: null,
                timezone: property.timezone || 'America/Chicago',
                locationText: property.address,
                instructions: null,
                rescheduleUrl: `${baseUrl}/book-showing/property/${existingShowing.propertyId}?reschedule=${existingShowing.id}`,
                idempotent: true,
              },
              sources: ['database:showings'],
            };
          }
        }
      }
      throw idemErr;
    }

    const baseUrl = getBaseUrlForBookingLink();
    const rescheduleUrl = `${baseUrl}/book-showing/property/${args.propertyId}?reschedule=${showing.id}`;
    console.log(`[create_tour_booking] ${requestId} Created showing ${showing.id} for lead ${leadId}`);

    // Send confirmation email and in-app notifications (same as Public Booking flow)
    try {
      const { notifyPublicShowingBooked } = await import("./notifications");
      const unit = args.unitId ? await storage.getPropertyUnit(args.unitId, orgId) : null;
      notifyPublicShowingBooked(showing, property, lead, storage, unit?.unitNumber).catch((err) => {
        console.error("[create_tour_booking] Failed to send confirmation notifications:", err);
      });
    } catch (notifyErr: any) {
      console.error("[create_tour_booking] Error sending notifications:", notifyErr?.message);
    }

    return {
      success: true,
      data: {
        bookingId: showing.id,
        startTimeISO: `${date}T${time}:00`,
        endTimeISO: null,
        timezone: property.timezone || 'America/Chicago',
        locationText: location,
        instructions: null,
        rescheduleUrl,
      },
      sources: ['database:showings'],
    };
  } catch (error: any) {
    console.error(`[create_tour_booking] ${requestId} Error:`, error);
    if (error.code === '23505' || error.message?.includes('unique')) {
      return {
        success: false,
        error: 'This time slot is no longer available. Please select another time.',
        sources: ['database:showings'],
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to create tour booking',
      sources: ['database:showings'],
    };
  }
}

/**
 * Get qualification requirements for a property or organization
 */
export async function getQualifications(
  orgId: string,
  propertyId?: string
): Promise<ToolResult> {
  try {
    // Get qualification settings (property-level overrides org-level)
    let qualificationSettings = await storage.getOrgQualificationSettings(orgId);
    
    if (propertyId) {
      const propertyQualificationSettings = await storage.getPropertyQualificationSettings(propertyId, orgId);
      if (propertyQualificationSettings) {
        qualificationSettings = propertyQualificationSettings;
      }
    }

    if (!qualificationSettings || !qualificationSettings.qualifications) {
      return {
        success: true,
        data: {
          propertyId: propertyId || null,
          hasQualifications: false,
          message: "No specific qualification requirements have been set"
        },
        sources: ['database:qualification_settings']
      };
    }

    // Parse qualifications (handle both JSON string and array formats)
    let quals: any[] = [];
    if (typeof qualificationSettings.qualifications === 'string') {
      try {
        quals = JSON.parse(qualificationSettings.qualifications);
      } catch (e) {
        console.error('[getQualifications] Error parsing qualifications string:', e);
      }
    } else if (Array.isArray(qualificationSettings.qualifications)) {
      quals = qualificationSettings.qualifications;
    }

    // Format qualifications for response
    const formattedQualifications = quals.map((qual: any) => {
      const config = qual.config || {};
      const result: any = {
        type: qual.type,
        label: qual.label || qual.type,
        enabled: qual.enabled !== false,
        isDealBreaker: qual.isDealBreaker || false,
      };

      // Extract value and create human-readable descriptions based on type and config
      let value: string | number | undefined;
      let description: string;

      if (qual.type === 'income') {
        value = config.incomeMultiplier;
        description = value ? `${value}x monthly rent` : 'Income requirement not specified';
        result.value = value;
        result.description = `Income requirement: ${description}`;
        result.category = 'financial';
      } else if (qual.type === 'credit_score') {
        value = config.minCreditScore;
        description = value ? `Minimum ${value}` : 'Credit score requirement not specified';
        result.value = value;
        result.description = `Minimum credit score: ${description}`;
        result.category = 'financial';
      } else if (qual.type === 'rental_history') {
        const parts: string[] = [];
        if (config.maxEvictions !== undefined) {
          parts.push(`Max ${config.maxEvictions} eviction${config.maxEvictions !== 1 ? 's' : ''}`);
        }
        if (config.minRentalYears !== undefined) {
          parts.push(`Min ${config.minRentalYears} year${config.minRentalYears !== 1 ? 's' : ''} rental history`);
        }
        description = parts.length > 0 ? parts.join(', ') : 'Rental history requirement not specified';
        result.value = description;
        result.description = `Rental history: ${description}`;
        result.category = 'rental_history';
      } else if (qual.type === 'criminal_history') {
        value = config.allowCriminalHistory;
        description = value === true ? 'Criminal history allowed' : value === false ? 'No criminal history allowed' : 'Criminal history requirement not specified';
        result.value = value;
        result.description = `Criminal history: ${description}`;
        result.category = 'rental_history';
      } else if (qual.type === 'employment') {
        value = config.minEmploymentMonths;
        description = value ? `Minimum ${value} month${value !== 1 ? 's' : ''} employment` : 'Employment requirement not specified';
        result.value = value;
        result.description = `Employment: ${description}`;
        result.category = 'employment';
      } else if (qual.type === 'occupants') {
        value = config.maxOccupants;
        description = value ? `Maximum ${value} occupant${value !== 1 ? 's' : ''}` : 'Occupant limit not specified';
        result.value = value;
        result.description = `Occupants: ${description}`;
        result.category = 'other';
      } else if (qual.type === 'pets') {
        const parts: string[] = [];
        if (config.petsAllowed !== undefined) {
          parts.push(config.petsAllowed ? 'Pets allowed' : 'No pets allowed');
        }
        if (config.petFee !== undefined && config.petFee > 0) {
          parts.push(`Pet fee: $${config.petFee}`);
        }
        description = parts.length > 0 ? parts.join(', ') : 'Pet policy not specified';
        result.value = description;
        result.description = `Pet policy: ${description}`;
        result.category = 'property_rules';
      } else if (qual.type === 'security_deposit') {
        const parts: string[] = [];
        if (config.depositMultiplier !== undefined) {
          parts.push(`${config.depositMultiplier}x monthly rent`);
        }
        if (config.minDeposit !== undefined) {
          parts.push(`Minimum $${config.minDeposit}`);
        }
        description = parts.length > 0 ? parts.join(', ') : 'Security deposit requirement not specified';
        result.value = description;
        result.description = `Security deposit: ${description}`;
        result.category = 'financial';
      } else {
        // Fallback for legacy format or unknown types
        value = qual.value;
        description = value !== undefined ? String(value) : `${qual.label || qual.type} requirement not specified`;
        result.value = value;
        result.description = `${qual.label || qual.type}: ${description}`;
        result.category = 'other';
      }

      return result;
    });

    return {
      success: true,
      data: {
        propertyId: propertyId || null,
        hasQualifications: true,
        qualifications: formattedQualifications,
        source: propertyId ? 'property' : 'organization',
        totalRequirements: formattedQualifications.length
      },
      sources: ['database:qualification_settings']
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get qualifications',
      sources: ['database:qualification_settings']
    };
  }
}

/**
 * Get application status (requires authentication)
 */
export async function getApplicationStatus(
  orgId: string,
  leadId: string
): Promise<ToolResult> {
  try {
    const lead = await storage.getLead(leadId, orgId);
    if (!lead) {
      return {
        success: false,
        error: `Lead ${leadId} not found`,
        sources: ['database:leads']
      };
    }

    // Get lead status and any application data
    return {
      success: true,
      data: {
        leadId: lead.id,
        leadName: lead.name,
        status: lead.status,
        propertyName: lead.propertyName,
        moveInDate: lead.moveInDate,
        // Add application-specific fields if available
        applicationSubmitted: lead.status === 'application' || lead.status === 'approved' || lead.status === 'rejected',
        currentStage: lead.status
      },
      sources: ['database:leads']
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get application status',
      sources: ['database:leads']
    };
  }
}

/**
 * Get organization name and assigned leasing agent(s) for a property/unit.
 * Use when the lead asks "who is the company?", "who will show me the property?", "leasing agent", etc.
 */
export async function getPropertyContactInfo(
  orgId: string,
  propertyId?: string,
  unitId?: string
): Promise<ToolResult> {
  try {
    const org = await storage.getOrganization(orgId);
    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
        sources: ['database:organizations']
      };
    }

    const result: {
      organizationName: string;
      propertyName?: string;
      unitNumber?: string;
      assignedMembers: Array<{ name: string; email?: string; role?: string }>;
    } = {
      organizationName: org.name,
      assignedMembers: []
    };

    if (propertyId) {
      const property = await storage.getProperty(propertyId, orgId);
      if (!property) {
        return {
          success: true,
          data: result,
          sources: ['database:organizations']
        };
      }
      result.propertyName = property.name;

      if (unitId) {
        const unit = await storage.getPropertyUnit(unitId, orgId);
        if (unit) result.unitNumber = unit.unitNumber ?? undefined;
      }

      const propertySettings = await storage.getPropertySchedulingSettings(propertyId, orgId);
      let unitSettings: Awaited<ReturnType<typeof storage.getUnitSchedulingSettings>> | null = null;
      if (unitId) {
        unitSettings = await storage.getUnitSchedulingSettings(unitId, orgId);
      }

      const assignedMembers = (unitSettings?.customAssignedMembers ?? propertySettings?.assignedMembers) ?? [];
      const memberIds = assignedMembers.map((m: any) => typeof m === 'string' ? m : (m?.userId ?? m)).filter(Boolean);

      for (const userId of memberIds) {
        const user = await storage.getUser(userId);
        if (user) {
          const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Leasing agent';
          result.assignedMembers.push({
            name,
            email: user.email ?? undefined
          });
        }
      }
    }

    return {
      success: true,
      data: result,
      sources: ['database:organizations', 'database:property_scheduling_settings', 'database:users']
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get contact info',
      sources: ['database:organizations']
    };
  }
}

/**
 * OpenAI function calling tool definitions
 */
export const aiToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_availability",
      description: "Get real-time unit availability for a property. Use this when the lead asks about availability, 'is X available?', 'what units do you have?', etc. Returns units that are listed (occupancy status does not matter). For tour scheduling questions, use get_tour_slots instead.",
      parameters: {
        type: "object",
        properties: {
          propertyId: {
            type: "string",
            description: "Property ID (optional - if not provided, returns all available properties)"
          },
          unitId: {
            type: "string",
            description: "Specific unit ID (optional)"
          },
          dates: {
            type: "object",
            description: "Date range for availability check (optional)",
            properties: {
              start: { type: "string", format: "date" },
              end: { type: "string", format: "date" }
            }
          }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "quote_price",
      description: "Get pricing information for a specific unit including rent, deposit, fees. Use this when the lead asks about pricing, rent, deposits, move-in costs, etc.",
      parameters: {
        type: "object",
        properties: {
          unitId: {
            type: "string",
            description: "Unit ID (required)"
          },
          moveInDate: {
            type: "string",
            format: "date",
            description: "Move-in date for pricing calculation (optional)"
          }
        },
        required: ["unitId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_tour_slots",
      description: "Get available tour/showing time slots for a property. Use this when the lead asks about scheduling a tour, viewing, showing, appointment, etc. Returns slots only for units that are listed AND have booking enabled (occupancy status does not matter).",
      parameters: {
        type: "object",
        properties: {
          propertyId: {
            type: "string",
            description: "Property ID (required)"
          },
          unitId: {
            type: "string",
            description: "Specific unit ID (optional)"
          },
          preferredTimes: {
            type: "array",
            items: { type: "string" },
            description: "Lead's preferred times (optional)"
          }
        },
        required: ["propertyId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_application_status",
      description: "Get application/screening status for a lead. Use this when the lead asks about their application status, screening progress, approval, etc. Requires authentication.",
      parameters: {
        type: "object",
        properties: {
          leadId: {
            type: "string",
            description: "Lead ID (required)"
          }
        },
        required: ["leadId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_portfolio_units",
      description: "List all properties and units in the portfolio. Use this when the lead asks 'what units are in your portfolio?', 'what do you manage?', 'what properties do you have?', 'show me your listings'. Returns all listed units regardless of availability.",
      parameters: {
        type: "object",
        properties: {
          propertyId: {
            type: "string",
            description: "Property ID (optional - if not provided, returns all properties)"
          }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_property_location",
      description: "Get property address/location for geocoding or nearby search. Use when you need the formatted address.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "Property ID (required)" },
        },
        required: ["propertyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_nearby_places_openai",
      description: "Search for nearby places (grocery, coffee, restaurants, parks, transit, etc.) around a property using web search. Use when the lead asks about 'what's around', 'nearby', 'neighborhood', 'walkable', 'transit', 'parks', 'restaurants'.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "Property ID (required)" },
          radiusMeters: { type: "number", description: "Search radius in meters (default 800)" },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Categories to search: grocery, coffee, restaurants, pharmacy, parks, transit, gym",
          },
        },
        required: ["propertyId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_property_contact_info",
      description: "Get the company (organization) name and the leasing agent(s) assigned to show the property. Use when the lead asks 'who is the company?', 'who will show me the property?', 'who is the leasing agent?', 'what is the property management company?', 'who do I meet for the tour?'.",
      parameters: {
        type: "object",
        properties: {
          propertyId: {
            type: "string",
            description: "Property ID (optional - if provided, returns assigned members for this property/unit)"
          },
          unitId: {
            type: "string",
            description: "Unit ID (optional - if provided, returns assigned members for this specific unit)"
          }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "upsert_lead_contact",
      description: "Save or update lead contact details (name, email, phone) in Lead2Lease. Use when collecting contact info for in-chat tour booking. Only updates fields that are provided.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "Lead ID (required)" },
          name: { type: "string", description: "Full name" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
        },
        required: ["leadId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_tour_booking",
      description: "Create a tour/showing booking in Lead2Lease. Use only after collecting name, email, phone and user has confirmed a slot. Idempotent - safe to retry.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "Lead ID (required)" },
          propertyId: { type: "string", description: "Property ID (required)" },
          unitId: { type: "string", description: "Unit ID (optional)" },
          slotId: { type: "string", description: "Slot ID from get_tour_slots, e.g. YYYY-MM-DD_HH:MM (required)" },
          contact: {
            type: "object",
            description: "Contact info (required)",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
            required: ["name", "email", "phone"],
          },
          idempotencyKey: { type: "string", description: "Unique key for idempotency, e.g. hash(leadId+slotId+date)" },
        },
        required: ["leadId", "propertyId", "slotId", "contact", "idempotencyKey"],
      },
    },
  },
];

/**
 * Execute a tool call
 */
export async function executeTool(
  toolName: string,
  args: any,
  orgId: string,
  leadId?: string
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_qualifications':
      return await getQualifications(orgId, args.propertyId);
    
    case 'get_availability':
      return await getAvailability(orgId, args.propertyId, args.unitId, args.dates);
    
    case 'quote_price':
      return await quotePrice(orgId, args.unitId, args.moveInDate);
    
    case 'get_tour_slots':
      return await getTourSlots(orgId, args.propertyId, args.unitId, args.preferredTimes);
    
    case 'get_application_status':
      if (!leadId) {
        return {
          success: false,
          error: 'Lead ID required for application status',
          sources: []
        };
      }
      return await getApplicationStatus(orgId, leadId);
    
    case 'list_portfolio_units':
      return await listPortfolioUnits(orgId, args.propertyId);
    
    case 'get_property_contact_info':
      return await getPropertyContactInfo(orgId, args.propertyId, args.unitId);

    case 'upsert_lead_contact':
      if (!leadId) {
        return { success: false, error: 'Lead ID required for upsert_lead_contact', sources: [] };
      }
      return await upsertLeadContact(orgId, leadId, args.name, args.email, args.phone);

    case 'create_tour_booking':
      if (!leadId) {
        return { success: false, error: 'Lead ID required for create_tour_booking', sources: [] };
      }
      return await createTourBooking(orgId, leadId, {
        propertyId: args.propertyId,
        unitId: args.unitId,
        slotId: args.slotId,
        contact: args.contact,
        idempotencyKey: args.idempotencyKey,
      });

    case 'get_property_location':
      const locRes = await getPropertyLocation(orgId, args.propertyId);
      return locRes.success
        ? { success: true, data: locRes.data, sources: ['database:properties'] }
        : { success: false, error: locRes.error, sources: [] };

    case 'get_nearby_places_openai':
      const nearbyRes = await getNearbyPlacesOpenAI(orgId, args.propertyId, {
        radiusMeters: args.radiusMeters,
        categories: args.categories,
      });
      return nearbyRes.success
        ? { success: true, data: nearbyRes.data, sources: nearbyRes.sources || [] }
        : { success: false, error: nearbyRes.error, sources: [] };
    
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        sources: []
      };
  }
}

