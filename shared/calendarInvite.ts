/**
 * Calendar invite (ICS) generator utility
 * Generates RFC5545-compliant calendar invites for showing bookings
 */

import { DateTime } from 'luxon';

export interface CalendarEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // 24-hour time (HH:MM)
  durationMinutes: number;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName?: string;
  unitNumber?: string; // Unit number for multi-unit properties (displayed as "Apartment {x}")
  manageBookingUrl?: string; // URL to manage booking (reschedule/cancel)
  assignedContact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  organizationName?: string;
}

/**
 * Formats a date-time to ICS format in UTC (YYYYMMDDTHHmmssZ)
 * Uses luxon for proper timezone conversion including DST handling
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @param timeStr 24-hour time (HH:MM) in America/Chicago timezone
 * @param timezone IANA timezone (default: America/Chicago for CST/CDT)
 */
function formatICSDateTime(dateStr: string, timeStr: string, timezone: string = 'America/Chicago'): string {
  // Parse date and time components
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create DateTime in the specified timezone using luxon
  // This properly handles DST transitions
  const localDateTime = DateTime.fromObject(
    { year, month, day, hour: hours, minute: minutes, second: 0 },
    { zone: timezone }
  );
  
  // Convert to UTC
  const utcDateTime = localDateTime.toUTC();
  
  // Format as YYYYMMDDTHHmmssZ (UTC format per RFC 5545)
  return utcDateTime.toFormat("yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Adds minutes to a time string
 * @param timeStr 24-hour time (HH:MM)
 * @param minutes Number of minutes to add
 * @returns New time string (HH:MM)
 */
function addMinutes(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

/**
 * Escapes text for ICS format
 * Handles line breaks, commas, and semicolons according to RFC5545
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates a calendar invite (ICS file) for a showing booking
 * @param event Calendar event details
 * @returns ICS file content as string
 */
export function generateCalendarInvite(event: CalendarEvent): string {
  const timezone = 'America/Chicago';
  const startDateTime = formatICSDateTime(event.startDate, event.startTime, timezone);
  const endTime = addMinutes(event.startTime, event.durationMinutes);
  const endDateTime = formatICSDateTime(event.startDate, endTime, timezone);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  // Build location with unit number if provided
  // Format: "Property Address\nApartment {x}" if unit number exists
  const locationWithUnit = event.unitNumber 
    ? `${event.location}\nApartment ${event.unitNumber}`
    : event.location;
  
  // Format time for display (12-hour format)
  const formatTimeForDisplay = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };
  
  // Build enhanced description with all details
  // Start with the base description (which includes event description if available, address, and instructions)
  let enhancedDescription = event.description || '';
  
  // Ensure we have a base description
  if (!enhancedDescription.trim()) {
    enhancedDescription = 'Property showing has been scheduled.';
  }
  
  // Check if event time is already in the description (for confirmation emails)
  // If not, add it here (for other email types like reschedule)
  const hasEventTime = enhancedDescription.includes('Event Time:');
  if (!hasEventTime) {
    // Add event time and duration
    const eventTime = formatTimeForDisplay(event.startTime);
    const endTimeDisplay = formatTimeForDisplay(endTime);
    enhancedDescription += `\n\nEvent Time: ${eventTime} - ${endTimeDisplay} (${event.durationMinutes} minutes)`;
  }
  
  // Add assigned contact if provided
  if (event.assignedContact) {
    enhancedDescription += '\n\nYour Contact:';
    if (event.assignedContact.name) {
      enhancedDescription += `\n${event.assignedContact.name}`;
    }
    if (event.assignedContact.email) {
      enhancedDescription += `\nEmail: ${event.assignedContact.email}`;
    }
    if (event.assignedContact.phone) {
      enhancedDescription += `\nPhone: ${event.assignedContact.phone}`;
    }
  }
  
  // Add manage booking URL if provided
  if (event.manageBookingUrl) {
    enhancedDescription += `\n\nManage Your Booking: ${event.manageBookingUrl}`;
  }
  
  // Add organization branding at the bottom, above "Booked via Lead2Lease"
  if (event.organizationName) {
    enhancedDescription += `\n\n${event.organizationName}\nProperty Management Company`;
  }
  
  // Add "Booked via Lead2Lease" at the very bottom
  enhancedDescription += `\n\nBooked via Lead2Lease`;
  
  // Escape special characters in text fields
  const title = escapeICSText(event.title);
  const description = escapeICSText(enhancedDescription);
  const location = escapeICSText(locationWithUnit);
  
  // Build ICS content (RFC5545 format)
  // Use UTC format (DTSTART:...Z) without TZID for maximum compatibility
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lead2Lease//Property Showing//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}@lead2lease.ai`,
    `DTSTAMP:${now}`,
    `DTSTART:${startDateTime}`,
    `DTEND:${endDateTime}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${escapeICSText(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${escapeICSText(event.attendeeName || event.attendeeEmail)};RSVP=TRUE:mailto:${event.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  
  return icsContent.join('\r\n');
}
