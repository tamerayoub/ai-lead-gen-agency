import { storage } from "./storage";
import { format, addDays, startOfDay, endOfDay } from "date-fns";

interface AvailabilitySlot {
  day: string;
  date: string;
  preferredTimes?: string;
  busyTimes: string[];
  availableSlots: string[];
}

export async function getAvailabilityContext(): Promise<string> {
  try {
    // Check if there are any active calendar connections
    const connections = await storage.getCalendarConnections();
    const activeConnections = connections.filter(c => c.isActive);
    
    if (activeConnections.length === 0) {
      return "Calendar integration: Not configured. Suggest general availability windows.";
    }

    // Get schedule preferences
    const preferences = await storage.getSchedulePreferences();
    
    // Get events for the next 7 days
    const today = new Date();
    const nextWeek = addDays(today, 7);
    const events = await storage.getAllCalendarEvents(startOfDay(today), endOfDay(nextWeek));
    
    // Build availability context
    const availabilitySlots: AvailabilitySlot[] = [];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < 7; i++) {
      const targetDate = addDays(today, i);
      const dayOfWeek = dayNames[targetDate.getDay()];
      const dayStart = startOfDay(targetDate);
      const dayEnd = endOfDay(targetDate);
      
      // Get preference for this day
      const dayPreference = preferences.find(p => p.dayOfWeek.toLowerCase() === dayOfWeek);
      
      // Get events for this day (including events that span multiple days)
      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        // Proper overlap detection: event overlaps if it starts before day ends AND ends after day starts
        return eventStart < dayEnd && eventEnd > dayStart;
      });
      
      // Build availability slot
      const slot: AvailabilitySlot = {
        day: dayOfWeek,
        date: format(targetDate, 'MMM d'),
        preferredTimes: dayPreference 
          ? `${dayPreference.startTime} - ${dayPreference.endTime}`
          : undefined,
        busyTimes: dayEvents.map(e => {
          if (e.isAllDay) {
            return `All day: ${e.title}`;
          }
          const eventStart = new Date(e.startTime);
          const eventEnd = new Date(e.endTime);
          
          // Check if event spans multiple days
          if (eventStart < dayStart || eventEnd > dayEnd) {
            return `${format(eventStart, 'h:mm a')} - ${format(eventEnd, 'h:mm a')}: ${e.title} (multi-day event)`;
          }
          
          return `${format(eventStart, 'h:mm a')} - ${format(eventEnd, 'h:mm a')}: ${e.title}`;
        }),
        availableSlots: [], // Could compute free slots, but AI can infer from busy times
      };
      
      availabilitySlots.push(slot);
    }
    
    // Format availability context for AI
    let context = "Calendar Availability (Next 7 Days):\n\n";
    
    for (const slot of availabilitySlots) {
      context += `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}, ${slot.date}:\n`;
      
      if (slot.preferredTimes) {
        context += `  - Preferred showing times: ${slot.preferredTimes}\n`;
      }
      
      if (slot.busyTimes.length > 0) {
        context += `  - Busy: ${slot.busyTimes.join(', ')}\n`;
      } else if (slot.preferredTimes) {
        context += `  - Available during preferred times\n`;
      } else {
        context += `  - No calendar conflicts\n`;
      }
      
      context += '\n';
    }
    
    context += "\nWhen suggesting showing times:\n";
    context += "1. Use the preferred showing times if available\n";
    context += "2. Avoid busy times shown above\n";
    context += "3. Suggest specific dates and times (e.g., 'Tuesday, Dec 12 at 2:00 PM')\n";
    context += "4. Offer 2-3 specific time options if possible\n";
    
    return context;
  } catch (error) {
    console.error("Error getting availability context:", error);
    return "Calendar integration: Error fetching availability. Suggest general availability windows.";
  }
}
