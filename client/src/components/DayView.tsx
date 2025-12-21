import { format, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Showing } from "@shared/schema";
import { getMemberColor, getShowingColor } from "@/lib/teamColors";
import { useState, useEffect } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
  userId: string | null;
  provider: string;
}

interface DayViewProps {
  date: Date;
  showings: Showing[];
  events: CalendarEvent[];
  orgMembers: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  onShowingClick?: (showingId: string) => void;
  onEventClick?: (eventId: string) => void;
}

interface PositionedEvent {
  id: string;
  title: string;
  type: 'showing' | 'event';
  top: number;
  height: number;
  startTime: Date;
  endTime: Date;
  status?: string;
  location?: string;
  userId?: string | null;
  assignedTo?: string | null;
  overlap: boolean;
  durationMinutes: number;
  leadName?: string | null;
  propertyName?: string | null;
  left?: number; // Left position for side-by-side layout (0-1, percentage)
  width?: number; // Width for side-by-side layout (0-1, percentage)
  overlapIndex?: number; // Index within overlap group (0-based)
  overlapCount?: number; // Total number of overlapping events
}

const PIXELS_PER_MINUTE = 1.33;
const HOUR_HEIGHT = 80;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_LABEL_WIDTH = 80;
const MIN_EVENT_HEIGHT = 20; // Minimum height to ensure text isn't cut off

export default function DayView({ date, showings, events, orgMembers, onShowingClick, onEventClick }: DayViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isToday = isSameDay(date, new Date());
  
  // Update current time every minute
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [isToday]);

  const timeLabels = Array.from({ length: TOTAL_HOURS }, (_, hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return { hour, label: `${displayHour} ${period}` };
  });

  // Calculate current time position
  const currentTimeTop = isToday ? (currentTime.getHours() * 60 + currentTime.getMinutes()) * PIXELS_PER_MINUTE : null;

  const getShowingPosition = (showing: Showing): PositionedEvent | null => {
    try {
      const [hours, minutes] = showing.scheduledTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }

      const minutesFromMidnight = hours * 60 + minutes;
      const top = minutesFromMidnight * PIXELS_PER_MINUTE;
      const baseHeight = Math.max(showing.durationMinutes * PIXELS_PER_MINUTE, MIN_EVENT_HEIGHT);

      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + showing.durationMinutes);

      const enrichedShowing = showing as any;
      const derivedLeadName =
        enrichedShowing.leadName ||
        [enrichedShowing.leadFirstName, enrichedShowing.leadLastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        null;
      const needsLeadSpace = showing.durationMinutes >= 45 && !!derivedLeadName;
      const height = needsLeadSpace ? Math.max(baseHeight, 56) : baseHeight;
      return {
        id: showing.id,
        title: enrichedShowing.eventName || showing.title,
        type: 'showing',
        top,
        height,
        startTime,
        endTime,
        status: showing.status,
        location: showing.location,
        assignedTo: showing.assignedTo,
        overlap: false,
        durationMinutes: showing.durationMinutes,
        leadName: derivedLeadName,
        propertyName: enrichedShowing.propertyName || null,
      };
    } catch {
      return null;
    }
  };

  const getEventPosition = (event: CalendarEvent): PositionedEvent | null => {
    if (event.isAllDay) return null;

    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const startHours = startTime.getHours();
    const startMinutes = startTime.getMinutes();

    const minutesFromMidnight = startHours * 60 + startMinutes;
    const top = minutesFromMidnight * PIXELS_PER_MINUTE;
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const height = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_EVENT_HEIGHT);

    return {
      id: event.id,
      title: event.title,
      type: 'event',
      top,
      height,
      startTime,
      endTime,
      location: event.location,
      userId: event.userId,
      overlap: false,
      durationMinutes,
    };
  };

  // Group overlapping events and calculate side-by-side positions
  const calculateOverlapPositions = (events: PositionedEvent[]): PositionedEvent[] => {
    const MAX_OVERLAPS = 10; // Maximum side-by-side events in day view
    const enriched = events.map((event) => ({ ...event, left: 0, width: 1, overlapIndex: 0, overlapCount: 1 }));
    
    // Group events by overlapping time ranges
    const overlapGroups: PositionedEvent[][] = [];
    
    for (const event of enriched) {
      let addedToGroup = false;
      
      // Try to add to existing group
      for (const group of overlapGroups) {
        // Check if this event overlaps with any event in the group
        const overlapsWithGroup = group.some(existing => 
          event.startTime < existing.endTime && existing.startTime < event.endTime
        );
        
        if (overlapsWithGroup) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }
      
      // Create new group if no overlap found
      if (!addedToGroup) {
        overlapGroups.push([event]);
      }
    }
    
    // Calculate positions for each group
    for (const group of overlapGroups) {
      if (group.length === 1) {
        // No overlap, full width
        group[0].overlap = false;
        group[0].left = 0;
        group[0].width = 1;
        group[0].overlapIndex = 0;
        group[0].overlapCount = 1;
      } else {
        // Has overlaps, calculate side-by-side positions
        const visibleCount = Math.min(group.length, MAX_OVERLAPS);
        const widthPerEvent = 1 / visibleCount;
        
        group.forEach((event, index) => {
          event.overlap = true;
          event.overlapIndex = index;
          event.overlapCount = group.length;
          
          if (index < MAX_OVERLAPS) {
            // Visible events get side-by-side positions
            event.left = index * widthPerEvent;
            event.width = widthPerEvent;
          } else {
            // Hidden events (beyond max) - mark for filtering
            event.left = -1; // Mark as hidden
            event.width = 0;
          }
        });
      }
    }
    
    return enriched;
  };

  const positionedShowings = showings.map(getShowingPosition).filter((e): e is PositionedEvent => e !== null);
  const positionedCalendarEvents = events.map(getEventPosition).filter((e): e is PositionedEvent => e !== null);
  const allEvents = [...positionedShowings, ...positionedCalendarEvents].sort((a, b) => a.top - b.top);
  const positionedEvents = calculateOverlapPositions(allEvents).filter(e => e.left !== undefined && e.left >= 0);

  const handleEventClick = (event: PositionedEvent) => {
    if (event.type === 'showing' && onShowingClick) {
      onShowingClick(event.id);
    } else if (event.type === 'event' && onEventClick) {
      onEventClick(event.id);
    }
  };

  return (
    <div className="relative">
      {/* Timeline grid - Google/iCloud style with absolute positioning */}
      <div className="flex">
        {/* Time labels column - uses absolute positioning for labels */}
        <div 
          className="flex-shrink-0 relative"
          style={{ width: TIME_LABEL_WIDTH, height: TOTAL_HEIGHT }}
        >
          {timeLabels.map(({ hour, label }) => (
            <div
              key={hour}
              className="absolute right-0 pr-3 text-sm text-muted-foreground"
              style={{ top: hour * HOUR_HEIGHT }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Events column */}
        <div
          className="flex-1 relative border-l"
          style={{ height: TOTAL_HEIGHT }}
        >
          {/* Hour grid lines - absolutely positioned */}
          {timeLabels.map(({ hour }) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border"
              style={{ top: hour * HOUR_HEIGHT }}
            />
          ))}

          {/* Current time indicator - blue line */}
          {isToday && currentTimeTop !== null && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              <div className="absolute left-0 right-0 h-0.5 bg-blue-500" />
              <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1.5 -translate-y-1.5 rounded-full bg-blue-500" />
            </div>
          )}

          {/* Events - absolutely positioned based on minutesFromMidnight */}
          {positionedEvents.map((event) => {
            const eventColor = event.type === 'showing'
              ? (event.assignedTo ? getMemberColor(event.assignedTo, orgMembers) : getShowingColor())
              : getMemberColor(event.userId, orgMembers);

            const durationMinutes = event.durationMinutes || 30;
            const overlapCount = event.overlapCount || 1;
            const overlapIndex = event.overlapIndex || 0;
            const leftPercent = (event.left || 0) * 100;
            const widthPercent = (event.width || 1) * 100;
            const startLabel = format(event.startTime, "h:mm a");
            const endLabel = format(event.endTime, "h:mm a");
            const showTimeLabel = durationMinutes >= 15;
            const isCompact = event.height < 26;
            // Show property name for 30+ minute events
            const showPropertyName = durationMinutes >= 30 && !!event.propertyName && event.height >= 28;
            // Show lead name for 45+ minute events, below property name (need enough height for both)
            const showLeadName = durationMinutes >= 45 && !!event.leadName && event.height >= 40;
            const showLocation = durationMinutes >= 60 && !!event.location && event.height >= 60 && !showPropertyName;
            const showDetailedTimeRange = durationMinutes >= 45 && event.height >= 70;
            const showSeeMore = overlapCount > 10 && overlapIndex === 9;

            return (
              <div
                key={`${event.type}-${event.id}`}
                className="absolute rounded-md cursor-pointer overflow-hidden transition-opacity hover:opacity-80"
                style={{
                  top: event.top,
                  height: event.height,
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  marginLeft: overlapIndex > 0 ? '2px' : '8px',
                  marginRight: '8px',
                }}
                onClick={() => handleEventClick(event)}
                data-testid={`dayview-${event.type}-${event.id}`}
                title={`${event.title} - ${startLabel} to ${endLabel}`}
              >
                <div className={`rounded-md ${eventColor.light} border-l-2 px-2 py-1 h-full`}>
                  {isCompact ? (
                    <div className="flex items-center justify-between gap-1 h-full overflow-hidden">
                      <p className="font-semibold text-xs truncate leading-tight">{event.title}</p>
                      {showTimeLabel && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap leading-tight">
                          {startLabel}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5 h-full overflow-hidden justify-start">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm truncate leading-tight">{event.title}</p>
                        {showTimeLabel && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap leading-tight text-right">
                            {startLabel}
                          </span>
                        )}
                      </div>
                      {showPropertyName && (
                        <p className="text-xs text-muted-foreground truncate leading-tight">{event.propertyName}</p>
                      )}
                      {showLeadName && (
                        <p className="text-xs text-muted-foreground truncate leading-tight">{event.leadName}</p>
                      )}
                      {showLocation && (
                        <p className="text-xs text-muted-foreground truncate leading-tight">{event.location}</p>
                      )}
                      {showDetailedTimeRange && (
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">
                          {startLabel} - {endLabel}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {showSeeMore && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                    +{overlapCount - 10} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {orgMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm mt-4">
          <span className="text-muted-foreground font-medium">Team Members:</span>
          {orgMembers.slice(0, 5).map((member) => {
            const displayName = member.firstName && member.lastName
              ? `${member.firstName} ${member.lastName}`
              : member.email;
            const color = getMemberColor(member.id, orgMembers);
            return (
              <div key={member.id} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${color.badge}`} />
                <span className="text-muted-foreground">{displayName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
