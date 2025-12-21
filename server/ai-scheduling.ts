import { format, parse, parseISO, addMinutes, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { Showing, Property, SchedulePreference, PropertySchedulingSettings } from '@shared/schema';

interface ConflictFlag {
  type: 'overlap' | 'travel_time' | 'outside_hours' | 'double_booking';
  severity: 'warning' | 'error';
  message: string;
  relatedShowingId?: string;
}

interface TimeSlotSuggestion {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  score: number; // 0-100
  reason: string;
  conflicts: ConflictFlag[];
}

interface RouteOptimizationData {
  previousShowingId?: string;
  nextShowingId?: string;
  distanceFromPrevious?: number; // miles
  distanceToNext?: number; // miles
  travelTimeFromPrevious?: number; // minutes
  travelTimeToNext?: number; // minutes
  optimizationScore?: number; // 0-100
}

/**
 * Detect conflicts for a showing against existing showings and schedule preferences
 */
export function detectConflicts(
  showing: Partial<Showing>,
  existingShowings: Showing[],
  schedulePreferences: SchedulePreference[],
  propertyTimezone?: string
): ConflictFlag[] {
  const conflicts: ConflictFlag[] = [];

  if (!showing.scheduledDate || !showing.scheduledTime) {
    return conflicts;
  }

  // Parse showing time - convert to UTC if timezone provided
  // Pass ISO string directly to fromZonedTime to avoid double timezone adjustment
  const showingStart = propertyTimezone 
    ? fromZonedTime(`${showing.scheduledDate}T${showing.scheduledTime}:00`, propertyTimezone)
    : parse(`${showing.scheduledDate} ${showing.scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
  const showingEnd = addMinutes(showingStart, showing.durationMinutes || 30);

  // Check for overlapping showings
  for (const existing of existingShowings) {
    // Skip the showing itself if updating
    if (existing.id === showing.id) continue;

    // Skip cancelled/no-show showings
    if (existing.status === 'cancelled' || existing.status === 'no_show') continue;

    // Parse existing showing time - convert to UTC if timezone provided
    // Pass ISO string directly to fromZonedTime to avoid double timezone adjustment
    const existingStart = propertyTimezone
      ? fromZonedTime(`${existing.scheduledDate}T${existing.scheduledTime}:00`, propertyTimezone)
      : parse(`${existing.scheduledDate} ${existing.scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const existingEnd = addMinutes(existingStart, existing.durationMinutes);

    // Check if times overlap
    const hasOverlap = 
      (isWithinInterval(showingStart, { start: existingStart, end: existingEnd }) ||
       isWithinInterval(showingEnd, { start: existingStart, end: existingEnd }) ||
       isWithinInterval(existingStart, { start: showingStart, end: showingEnd }));

    // Check if both showings have the same assigned agent
    const sameAgent = showing.assignedTo && existing.assignedTo && showing.assignedTo === existing.assignedTo;
    
    if (hasOverlap) {
      // If same agent, this is a double-booking conflict
      if (sameAgent) {
        conflicts.push({
          type: 'double_booking',
          severity: 'error',
          message: `Agent is already booked for another showing at ${existing.scheduledTime} for ${existing.title}`,
          relatedShowingId: existing.id,
        });
      } else {
        conflicts.push({
          type: 'overlap',
          severity: 'error',
          message: `Overlaps with showing at ${existing.scheduledTime} for ${existing.title}`,
          relatedShowingId: existing.id,
        });
      }
    } else {
      // Only check travel time if showings don't overlap
      // Check if existing showing ends before new showing starts (existing is "before")
      const timeAfterExisting = (showingStart.getTime() - existingEnd.getTime()) / (1000 * 60);
      // Check if new showing ends before existing showing starts (existing is "after")
      const timeBeforeExisting = (existingStart.getTime() - showingEnd.getTime()) / (1000 * 60);
      
      // Warn if there's a tight gap in either direction (less than 30 min buffer)
      if ((timeAfterExisting > 0 && timeAfterExisting < 30) || (timeBeforeExisting > 0 && timeBeforeExisting < 30)) {
        const gapMinutes = Math.min(
          timeAfterExisting > 0 ? timeAfterExisting : Infinity, 
          timeBeforeExisting > 0 ? timeBeforeExisting : Infinity
        );
        conflicts.push({
          type: 'travel_time',
          severity: 'warning',
          message: `Only ${Math.round(gapMinutes)} minutes between showings - may not allow enough travel time`,
          relatedShowingId: existing.id,
        });
      }
    }
  }

  // Check against schedule preferences
  const dayOfWeek = format(showingStart, 'EEEE').toLowerCase();
  const showingTimeStr = showing.scheduledTime;

  const dayPreference = schedulePreferences.find(
    pref => pref.dayOfWeek === dayOfWeek && pref.isActive
  );

  if (dayPreference) {
    // Parse times to minutes for proper comparison (handles 00:00 as end of day)
    const [prefStartHour, prefStartMin] = dayPreference.startTime.split(':').map(Number);
    const [prefEndHour, prefEndMin] = dayPreference.endTime.split(':').map(Number);
    const [showingHour, showingMin] = showingTimeStr.split(':').map(Number);
    
    const prefStartMinutes = prefStartHour * 60 + prefStartMin;
    // Handle 00:00 (12am) as end of day (24:00 = 1440 minutes)
    const prefEndMinutes = (prefEndHour === 0 && prefEndMin === 0) ? 24 * 60 : prefEndHour * 60 + prefEndMin;
    const showingMinutes = showingHour * 60 + showingMin;
    
    // Check if showing is within preferred hours using minute-based comparison
    if (showingMinutes < prefStartMinutes || showingMinutes >= prefEndMinutes) {
      conflicts.push({
        type: 'outside_hours',
        severity: 'warning',
        message: `Outside preferred hours (${dayPreference.startTime}-${dayPreference.endTime}) for ${dayOfWeek}`,
      });
    }
  }

  return conflicts;
}

/**
 * Calculate travel distance between two properties (simple Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate travel time based on distance (avg 30 mph in city)
 */
function estimateTravelTime(distanceMiles: number): number {
  const avgSpeedMph = 30;
  return Math.ceil((distanceMiles / avgSpeedMph) * 60); // minutes
}

/**
 * Optimize route for a showing by finding nearest neighboring showings
 */
export function optimizeRoute(
  showing: Showing,
  property: Property,
  allShowings: Showing[],
  allProperties: Map<string, Property>
): RouteOptimizationData {
  if (!property.latitude || !property.longitude) {
    return {};
  }

  // Filter showings to same day
  const sameDayShowings = allShowings.filter(s => 
    s.scheduledDate === showing.scheduledDate &&
    s.id !== showing.id &&
    s.status !== 'cancelled' &&
    s.status !== 'no_show'
  );

  if (sameDayShowings.length === 0) {
    return { optimizationScore: 100 }; // No other showings, perfect
  }

  const showingTime = parse(
    `${showing.scheduledDate} ${showing.scheduledTime}`,
    'yyyy-MM-dd HH:mm',
    new Date()
  );

  // Find closest showing before and after this one
  let closestBefore: { showing: Showing; distance: number; travelTime: number } | null = null;
  let closestAfter: { showing: Showing; distance: number; travelTime: number } | null = null;
  
  for (const other of sameDayShowings) {
    const otherTime = parse(
      `${other.scheduledDate} ${other.scheduledTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    
    // Check temporal ordering first
    const isBeforeShowing = isBefore(otherTime, showingTime);
    const isAfterShowing = isAfter(otherTime, showingTime);
    
    // Only calculate distance/time if this showing has coordinates
    const otherProperty = allProperties.get(other.propertyId);
    if (!otherProperty?.latitude || !otherProperty?.longitude) {
      // Skip showings without coordinates - can't calculate route data
      continue;
    }
    
    const distance = calculateDistance(
      otherProperty.latitude,
      otherProperty.longitude,
      property.latitude,
      property.longitude
    );
    const travelTime = estimateTravelTime(distance);
    
    if (isBeforeShowing) {
      // This showing is before the current one
      if (!closestBefore || distance < closestBefore.distance) {
        closestBefore = { showing: other, distance, travelTime };
      }
    } else if (isAfterShowing) {
      // This showing is after the current one
      if (!closestAfter || distance < closestAfter.distance) {
        closestAfter = { showing: other, distance, travelTime };
      }
    }
  }

  const showingEnd = addMinutes(showingTime, showing.durationMinutes);

  // Calculate optimization score (100 = perfect, 0 = terrible)
  let optimizationScore = 100;

  if (closestBefore) {
    // Penalty for distance (more than 10 miles is bad)
    const distancePenalty = Math.min((closestBefore.distance / 10) * 30, 30);
    optimizationScore -= distancePenalty;

    // Penalty for tight timing between previous showing end and this showing start
    const prevShowingEnd = addMinutes(
      parse(
        `${closestBefore.showing.scheduledDate} ${closestBefore.showing.scheduledTime}`,
        'yyyy-MM-dd HH:mm',
        new Date()
      ),
      closestBefore.showing.durationMinutes
    );
    const timeBetween = (showingTime.getTime() - prevShowingEnd.getTime()) / (1000 * 60);
    
    if (timeBetween < closestBefore.travelTime + 15) {
      optimizationScore -= 20; // Not enough time
    }
  }

  if (closestAfter) {
    // Additional penalty for distance to next showing
    const distancePenalty = Math.min((closestAfter.distance / 10) * 30, 30);
    optimizationScore -= distancePenalty;

    // Penalty for tight timing between this showing end and next showing start
    const nextShowingStart = parse(
      `${closestAfter.showing.scheduledDate} ${closestAfter.showing.scheduledTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    const timeBetween = (nextShowingStart.getTime() - showingEnd.getTime()) / (1000 * 60);
    
    if (timeBetween < closestAfter.travelTime + 15) {
      optimizationScore -= 20; // Not enough time
    }
  }

  return {
    previousShowingId: closestBefore?.showing.id,
    nextShowingId: closestAfter?.showing.id,
    distanceFromPrevious: closestBefore ? Math.round(closestBefore.distance * 10) / 10 : undefined,
    distanceToNext: closestAfter ? Math.round(closestAfter.distance * 10) / 10 : undefined,
    travelTimeFromPrevious: closestBefore?.travelTime,
    travelTimeToNext: closestAfter?.travelTime,
    optimizationScore: Math.max(0, Math.round(optimizationScore)),
  };
}

/**
 * Suggest optimal time slots for a showing based on calendar and route optimization
 * @param unitId - Optional unit ID for unit-level conflict checking. When provided, 
 *                 slots will be blocked if there are ANY existing showings for this unit
 *                 (regardless of member assignment)
 */
export function suggestTimeSlots(
  date: string,
  property: Property,
  existingShowings: Showing[],
  schedulePreferences: SchedulePreference[],
  allProperties: Map<string, Property>,
  propertySettings?: PropertySchedulingSettings | null,
  unitId?: string
): TimeSlotSuggestion[] {
  const suggestions: TimeSlotSuggestion[] = [];
  
  // Get day of week
  const targetDate = parse(date, 'yyyy-MM-dd', new Date());
  const dayOfWeek = format(targetDate, 'EEEE').toLowerCase();
  
  // Get ALL schedule preferences for this day (from all team members)
  const dayPreferences = schedulePreferences.filter(
    pref => pref.dayOfWeek === dayOfWeek && pref.isActive
  );

  // Removed verbose logging
  
  // Get assigned members from property settings to check if we should include members without preferences
  const assignedMemberIds: string[] = [];
  if (propertySettings?.assignedMembers && Array.isArray(propertySettings.assignedMembers)) {
    assignedMemberIds.push(...propertySettings.assignedMembers.map((m: any) => {
      if (typeof m === 'string') return m;
      if (m && typeof m === 'object' && m.userId) return m.userId;
      return null;
    }).filter((id): id is string => id !== null));
  }
  
  // If we have assigned members but no preferences, log a warning but continue
  // (The function will still work for members WITH preferences)
  if (assignedMemberIds.length > 0 && dayPreferences.length === 0) {
    console.warn(`[suggestTimeSlots] ⚠️ WARNING: ${assignedMemberIds.length} assigned members but NO schedule preferences for ${dayOfWeek}`);
    console.warn(`[suggestTimeSlots] Assigned members:`, assignedMemberIds);
    console.warn(`[suggestTimeSlots] This means NO time slots will be generated for this day`);
    console.warn(`[suggestTimeSlots] Members need schedule preferences set up to generate available time slots`);
    return suggestions; // No preferences for this day
  }
  
  if (dayPreferences.length === 0) {
    return suggestions; // No preferences for this day
  }

  // Use property settings or defaults (force numeric values)
  // Note: propertySettings may be an effectiveSettings object that includes unit-level overrides
  const eventDuration = Number(
    propertySettings?.eventDuration !== undefined && propertySettings?.eventDuration !== null
      ? propertySettings.eventDuration
      : 30
  );
  // Buffer time: use from settings, default to 15 if not specified
  // 0 is a valid value (no buffer), so we check for undefined/null explicitly
  const bufferTime = (propertySettings?.bufferTime !== undefined && propertySettings?.bufferTime !== null)
    ? Number(propertySettings.bufferTime)
    : 15; // Default buffer time from schema
  const leadTime = Number(
    propertySettings?.leadTime !== undefined && propertySettings?.leadTime !== null
      ? propertySettings.leadTime
      : 120
  );
  // Removed verbose logging
  
  // Get property timezone (default to Central Time if not set)
  const propertyTimezone = property.timezone || 'America/Chicago';
  
  // Get current time in UTC for comparison
  const nowUtc = new Date();
  const leadTimeMs = leadTime * 60 * 1000; // leadTime is in minutes, convert to milliseconds

  // Process each team member's preferences
  for (const dayPreference of dayPreferences) {
    // Parse preference times
    const [startHour, startMin] = dayPreference.startTime.split(':').map(Number);
    const [endHour, endMin] = dayPreference.endTime.split(':').map(Number);

    // Calculate start and end times in minutes from midnight
    const startMinutes = startHour * 60 + startMin;
    // Handle 00:00 (12am) as end of day (24:00 = 1440 minutes)
    // This allows availability to extend until midnight
    const endMinutes = (endHour === 0 && endMin === 0) ? 24 * 60 : endHour * 60 + endMin;

    // Get member ID for this preference
    const memberId = dayPreference.userId;
    // Removed verbose logging

  // Generate time slots at fixed 15-minute intervals regardless of event duration
  // Buffer time will block slots that are too close to existing showings
  // Example: With 15-min granularity, slots are generated at 6:00, 6:15, 6:30, 6:45, 7:00, etc.
  // Buffer logic will then filter out slots that are too close to existing bookings
  const GRANULARITY = 15; // Always use 15-minute intervals for slot generation
  for (let currentMinutes = startMinutes; currentMinutes + eventDuration <= endMinutes; currentMinutes += GRANULARITY) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;

    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Convert slot time from property timezone to UTC for accurate comparison
    // Pass ISO string directly to fromZonedTime to avoid double timezone adjustment
    const slotUtc = fromZonedTime(`${date}T${time}:00`, propertyTimezone);
    
    // Compare UTC times directly
    if (slotUtc.getTime() - nowUtc.getTime() < leadTimeMs) {
      continue; // Skip slots within lead time
    }
    
    // Check if this member is already booked at this time
    // Only show time slots where the assigned member is available
    const slotStart = propertyTimezone 
      ? fromZonedTime(`${date}T${time}:00`, propertyTimezone)
      : parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const slotEnd = addMinutes(slotStart, eventDuration);
    
    // CRITICAL: Verify that the slot end time doesn't exceed the preference end time
    // Calculate slot end in minutes from midnight
    const slotEndMinutes = hour * 60 + minute + eventDuration;
    // Handle 00:00 (12am) as end of day (24:00 = 1440 minutes)
    const effectiveEndMinutes = (endHour === 0 && endMin === 0) ? 24 * 60 : endMinutes;
    
    // Skip if slot would extend past the preference end time
    if (slotEndMinutes > effectiveEndMinutes) {
      // Removed verbose logging
      continue;
    }
    
    // Check conflicts at THREE levels:
    // 1. UNIT-LEVEL: Block if there are ANY showings for THIS UNIT (highest priority - a unit can only have one showing at a time)
    // 2. MEMBER-LEVEL: Block if this member has conflicting showings across ALL properties
    // 3. PROPERTY-LEVEL: Block if there are unassigned showings at THIS property
    let memberHasConflict = false;
    
    // LEVEL 1: Unit-level conflicts (if unitId is provided)
    // A unit can only have ONE showing at any given time - regardless of member assignment
    // This is the most important conflict check for unit-specific bookings
    const unitShowings = unitId ? existingShowings.filter(s => {
      const dateMatches = String(s.scheduledDate).trim() === String(date).trim();
      const unitMatches = s.unitId === unitId;
      const isActive = s.status !== 'cancelled' && s.status !== 'no_show';
      return dateMatches && unitMatches && isActive;
    }) : [];
    
    // LEVEL 2: Member-level conflicts (this member's showings across all properties)
    // Exclude unit showings to avoid double-counting
    const memberShowings = existingShowings.filter(s => {
      const dateMatches = String(s.scheduledDate).trim() === String(date).trim();
      const matchesMember = s.assignedTo && String(s.assignedTo) === String(memberId);
      const isActive = s.status !== 'cancelled' && s.status !== 'no_show';
      // Don't include showings already in unitShowings
      const notUnitShowing = !unitId || s.unitId !== unitId;
      return dateMatches && matchesMember && isActive && notUnitShowing;
    });
    
    // LEVEL 3: Property-level conflicts - ONLY for UNASSIGNED showings at this property
    // Unassigned showings (no assignedTo) block the entire slot for everyone
    // Showings WITH an assignee only block that specific agent (handled in memberShowings above)
    // This preserves the ability for different agents to run parallel showings at the same property
    const propertyShowings = existingShowings.filter(s => {
      const dateMatches = String(s.scheduledDate).trim() === String(date).trim();
      const propertyMatches = s.propertyId === property.id;
      const isActive = s.status !== 'cancelled' && s.status !== 'no_show';
      // CRITICAL: Only include UNASSIGNED showings (no assignedTo) for property-level blocking
      // This allows parallel agent bookings while still blocking unassigned slots
      const isUnassigned = !s.assignedTo;
      // Don't include showings already in unitShowings or memberShowings
      const notUnitShowing = !unitId || s.unitId !== unitId;
      const notMemberShowing = !(s.assignedTo && String(s.assignedTo) === String(memberId));
      return dateMatches && propertyMatches && isActive && isUnassigned && notUnitShowing && notMemberShowing;
    });
    
    // Combine all levels for conflict checking (unit first - highest priority)
    const allRelevantShowings = [...unitShowings, ...memberShowings, ...propertyShowings];
    
    // Check conflicts with all relevant showings (unit-level + member-level + property-level)
    for (const existing of allRelevantShowings) {
      
      // CRITICAL: Use the existing showing's property's timezone, not the current property's timezone
      // This is important when checking cross-property conflicts
      const existingProperty = allProperties.get(existing.propertyId);
      const existingTimezone = existingProperty?.timezone || propertyTimezone || 'America/Chicago';
      
      // Parse existing showing time using ITS property's timezone
      const existingStart = fromZonedTime(`${existing.scheduledDate}T${existing.scheduledTime}:00`, existingTimezone);
      const existingEnd = addMinutes(existingStart, existing.durationMinutes || 30);
      
      // Check if times overlap using standard interval overlap check
      // Two intervals overlap if: start1 < end2 && end1 > start2
      const slotStartTime = slotStart.getTime();
      const slotEndTime = slotEnd.getTime();
      const existingStartTime = existingStart.getTime();
      const existingEndTime = existingEnd.getTime();
      
      // Standard overlap check: slot overlaps existing if slot starts before existing ends AND slot ends after existing starts
      const hasOverlap = slotStartTime < existingEndTime && slotEndTime > existingStartTime;
      
      if (hasOverlap) {
        memberHasConflict = true;
        break;
      }
      
      // Also check buffer time if configured
      // Buffer time means: no new bookings within X minutes BEFORE or AFTER an existing showing
      if (bufferTime > 0) {
        // Calculate time gaps in minutes (with rounding to handle floating point precision issues)
        // timeBefore: gap between slot start and existing end (positive = slot is after existing, 0 = slot starts exactly when existing ends, negative = slot overlaps/ends before existing)
        const timeBefore = Math.round((slotStart.getTime() - existingEnd.getTime()) / (1000 * 60) * 100) / 100;
        // timeAfter: gap between existing start and slot end (positive = slot is before existing, 0 = slot ends exactly when existing starts, negative = slot overlaps/starts after existing)
        const timeAfter = Math.round((existingStart.getTime() - slotEnd.getTime()) / (1000 * 60) * 100) / 100;
        
        // Check if slot is AFTER existing event (slot starts after existing ends or exactly when it ends)
        // Block if slot starts within bufferTime minutes after existing ends (including exactly when existing ends)
        // Example: existing ends at 7:00, buffer=15, block slots starting at 7:00 through 7:14, allow 7:15+
        // timeBefore is 0 when slot starts exactly when existing ends, positive when slot starts after
        // We need to block if timeBefore is 0 or positive but less than bufferTime
        const slotIsAfterExisting = timeBefore >= 0;
        // Block if slot starts at or within bufferTime minutes after existing ends
        // Use < bufferTime (not <=) because we want to allow slots starting exactly at bufferTime minutes after
        // Example: existing ends at 7:00, buffer=15, block 7:00-7:14 (0-14 min gap), allow 7:15+ (15+ min gap)
        // CRITICAL: Block slots that start exactly when existing ends (timeBefore = 0) or within buffer
        const tooSoonAfter = slotIsAfterExisting && timeBefore < bufferTime;
        
        // Removed verbose buffer logging
        
        // Check if slot is BEFORE existing event (slot ends before or exactly when existing starts)
        // Block if slot ends within bufferTime minutes before existing starts
        // CRITICAL: Also block if slot ends EXACTLY when existing starts (timeAfter = 0) - there's no gap!
        // Example: existing starts at 10:00, buffer=15, block slots ending at 9:45 through 10:00
        //   - 9:15 slot (45min) ends at 10:00, timeAfter = 0, should be BLOCKED (no buffer at all)
        //   - 9:30 slot (45min) ends at 10:15, overlaps and already blocked by hasOverlap
        //   - 9:00 slot (45min) ends at 9:45, timeAfter = 15, should be allowed (exactly 15min buffer)
        // Use >= 0 to catch the edge case where slot ends exactly at existing start
        const slotIsBeforeExisting = timeAfter >= 0;
        // Block if slot ends at or within bufferTime minutes before existing starts
        // Use < bufferTime (not <=) because we want to allow slots ending exactly at bufferTime minutes before
        // Example: existing starts at 10:00, buffer=15
        //   - Block: timeAfter = 0 to 14 (slot ends 10:00 to 9:46)
        //   - Allow: timeAfter = 15+ (slot ends 9:45 or earlier)
        const tooSoonBefore = slotIsBeforeExisting && timeAfter < bufferTime;
        
        if (tooSoonAfter || tooSoonBefore) {
          memberHasConflict = true;
          break;
        }
      }
    }
    
    // Skip this time slot if the member is already booked
    if (memberHasConflict) {
      continue;
    }
    
    // CRITICAL: Double-check that slot doesn't extend past preference end time
    const slotEndMinutesCheck = hour * 60 + minute + eventDuration;
    const effectiveEndMinutesCheck = (endHour === 0 && endMin === 0) ? 24 * 60 : endMinutes;
    if (slotEndMinutesCheck > effectiveEndMinutesCheck) {
      continue;
    }
    // Member is available at this time - create the time slot
    // No need to check property-level conflicts since we allow multiple showings
    // at the same property/time if different members are handling them
    const testShowing: Partial<Showing> = {
      scheduledDate: date,
      scheduledTime: time,
      durationMinutes: eventDuration,
      propertyId: property.id,
    };

    // Calculate score based on route optimization
    let score = 100;
    let reason = `Available - assigned to member ${memberId}`;
    const conflicts: ConflictFlag[] = []; // Empty conflicts since member is available

    // Bonus for route optimization if no hard conflicts
    if (score > 0 && property.latitude && property.longitude) {
      const routeData = optimizeRoute(
        { ...testShowing, id: 'temp' } as Showing,
        property,
        existingShowings,
        allProperties
      );

      if (routeData.optimizationScore) {
        score = Math.round((score + routeData.optimizationScore) / 2);
        if (routeData.distanceFromPrevious && routeData.distanceFromPrevious < 5) {
          reason = `Optimal - only ${routeData.distanceFromPrevious} miles from previous showing`;
        }
      }
    }

    const slot = {
      date,
      time,
      score,
      reason,
      conflicts,
    };
    suggestions.push(slot);
    // Removed verbose logging
  }
  } // Close dayPreferences loop
  
  // Filter out slots with score 0 (hard conflicts) and sort by score descending
  const filteredSuggestions = suggestions
    .filter(slot => slot.score > 0) // Only return available slots
    .sort((a, b) => b.score - a.score);
  
  if (filteredSuggestions.length === 0 && suggestions.length > 0) {
    console.log(`[suggestTimeSlots] ⚠️ WARNING: ${suggestions.length} slots generated but all filtered out (score = 0)`);
  }
  
  return filteredSuggestions;
}

