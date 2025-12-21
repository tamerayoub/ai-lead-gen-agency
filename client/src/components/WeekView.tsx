import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
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

interface WeekViewProps {
  selectedDate: Date;
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
  onDayClick?: (date: Date) => void;
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
  dayIndex: number;
  userId?: string | null;
  assignedTo?: string | null;
  durationMinutes?: number;
  leadName?: string | null;
  propertyName?: string | null;
  overlap?: boolean;
  left?: number; // Left position for side-by-side layout (0-1, percentage)
  width?: number; // Width for side-by-side layout (0-1, percentage)
  overlapIndex?: number; // Index within overlap group (0-based)
  overlapCount?: number; // Total number of overlapping events
}

const PIXELS_PER_MINUTE = 1;
const HOUR_HEIGHT = 60;
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_LABEL_WIDTH = 64;
const MIN_EVENT_HEIGHT = 24; // Minimum height to ensure text isn't cut off (increased for 15-min events)

export default function WeekView({ selectedDate, showings, events, orgMembers, onShowingClick, onEventClick, onDayClick }: WeekViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const timeLabels = Array.from({ length: TOTAL_HOURS }, (_, hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return { hour, label: `${displayHour} ${period}` };
  });

  // Calculate current time position
  const currentTimeTop = (currentTime.getHours() * 60 + currentTime.getMinutes()) * PIXELS_PER_MINUTE;

  const getShowingPosition = (showing: Showing, dayIndex: number, day: Date): PositionedEvent | null => {
    try {
      const [hours, minutes] = showing.scheduledTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }

      const minutesFromMidnight = hours * 60 + minutes;
      const top = minutesFromMidnight * PIXELS_PER_MINUTE;
      // Ensure minimum height for readability, especially for 15-minute events
      const baseHeight = Math.max(showing.durationMinutes * PIXELS_PER_MINUTE, MIN_EVENT_HEIGHT);

      const startTime = new Date(day);
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
      const height = needsLeadSpace ? Math.max(baseHeight, 52) : baseHeight;
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
        dayIndex,
        assignedTo: showing.assignedTo,
        durationMinutes: showing.durationMinutes,
        leadName: derivedLeadName,
        propertyName: enrichedShowing.propertyName || null,
      };
    } catch {
      return null;
    }
  };

  const getEventPosition = (event: CalendarEvent, dayIndex: number): PositionedEvent | null => {
    if (event.isAllDay) return null;

    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const startHours = startTime.getHours();
    const startMinutes = startTime.getMinutes();

    const minutesFromMidnight = startHours * 60 + startMinutes;
    const top = minutesFromMidnight * PIXELS_PER_MINUTE;
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    // Ensure minimum height for readability, especially for 15-minute events
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
      dayIndex,
      userId: event.userId,
      durationMinutes,
    };
  };

  // Group overlapping events and calculate side-by-side positions
  const calculateOverlapPositions = (events: PositionedEvent[]): PositionedEvent[] => {
    const MAX_OVERLAPS = 3; // Maximum side-by-side events in week view
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

  const eventsByDay: PositionedEvent[][] = daysOfWeek.map((day, dayIndex) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayShowings = showings.filter(s => s.scheduledDate === dayStr);
    const dayEvents = events.filter(e => {
      const eventDate = e.startTime instanceof Date ? e.startTime : new Date(e.startTime);
      return format(eventDate, 'yyyy-MM-dd') === dayStr;
    });

    const dayEventsList = [
      ...dayShowings.map(s => getShowingPosition(s, dayIndex, day)).filter((e): e is PositionedEvent => e !== null),
      ...dayEvents.map(e => getEventPosition(e, dayIndex)).filter((e): e is PositionedEvent => e !== null),
    ].sort((a, b) => a.top - b.top);

    return calculateOverlapPositions(dayEventsList).filter(e => e.left !== undefined && e.left >= 0);
  });

  const handleEventClick = (event: PositionedEvent) => {
    if (event.type === 'showing' && onShowingClick) {
      onShowingClick(event.id);
    } else if (event.type === 'event' && onEventClick) {
      onEventClick(event.id);
    }
  };

  const handleDayColumnClick = (day: Date, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    if (onDayClick) onDayClick(day);
  };

  return (
    <div className="relative border rounded-md overflow-hidden">
      {/* Week header */}
      <div className="flex border-b bg-muted/30">
        <div style={{ width: TIME_LABEL_WIDTH }} className="flex-shrink-0 border-r" />
        {daysOfWeek.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isSameDay(day, new Date());
          return (
            <div
              key={index}
              className={`flex-1 p-2 text-center border-r last:border-r-0 ${isSelected ? 'bg-primary/5' : ''}`}
            >
              <div className="text-xs text-muted-foreground font-medium">{format(day, 'EEE')}</div>
              <div className={`text-sm font-semibold mt-1 ${isCurrentDay ? 'flex items-center justify-center w-7 h-7 mx-auto rounded-full bg-primary text-primary-foreground' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline grid - Google/iCloud style with absolute positioning */}
      <div className="overflow-auto" style={{ maxHeight: '600px' }}>
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Time labels column - uses absolute positioning for labels */}
          <div 
            className="flex-shrink-0 border-r bg-muted/10 relative"
            style={{ width: TIME_LABEL_WIDTH, height: TOTAL_HEIGHT }}
          >
            {timeLabels.map(({ hour, label }) => (
              <div
                key={hour}
                className="absolute right-0 pr-2 text-xs text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {daysOfWeek.map((day, dayIndex) => {
            const isSelected = isSameDay(day, selectedDate);
            return (
              <div
                key={dayIndex}
                className={`flex-1 relative border-r last:border-r-0 cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                style={{ height: TOTAL_HEIGHT }}
                onClick={(e) => handleDayColumnClick(day, e)}
                data-testid={`weekview-day-${format(day, 'yyyy-MM-dd')}`}
              >
                {/* Hour grid lines - absolutely positioned */}
                {timeLabels.map(({ hour }) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-border"
                    style={{ top: hour * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time indicator - blue line (only for today) */}
                {isSameDay(day, new Date()) && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="absolute left-0 right-0 h-0.5 bg-blue-500" />
                    <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1.5 -translate-y-1.5 rounded-full bg-blue-500" />
                  </div>
                )}

                {/* Events - absolutely positioned based on minutesFromMidnight */}
                {eventsByDay[dayIndex].map((event) => {
                  const eventColor = event.type === 'showing'
                    ? (event.assignedTo ? getMemberColor(event.assignedTo, orgMembers) : getShowingColor())
                    : getMemberColor(event.userId, orgMembers);

                  const durationMinutes = event.durationMinutes || 30;
                  const startLabel = format(event.startTime, "h:mm a");
                  const overlapCount = event.overlapCount || 1;
                  const overlapIndex = event.overlapIndex || 0;
                  
                  // Calculate left and width for side-by-side layout
                  const leftPercent = (event.left || 0) * 100;
                  const widthPercent = (event.width || 1) * 100;
                  
                  // Priority: Event name first, time second, lead name third
                  // Don't show time for side-by-side events (overlapping)
                  const hasOverlap = overlapCount > 1;
                  const showTimeLabel = durationMinutes >= 15 && !hasOverlap;
                  // Show property name for 45+ minute events only (not 30 min)
                  const showPropertyName = durationMinutes >= 45 && !!event.propertyName && event.height >= 28;
                  // Show lead name for 45+ minute events, below property name (need enough height for both)
                  const showLeadName = durationMinutes >= 45 && !!event.leadName && showPropertyName && event.height >= 40;
                  
                  // Show "see more" indicator if there are more than 3 overlapping events
                  const showSeeMore = overlapCount > 3 && overlapIndex === 2;

                  return (
                    <div
                      key={`${event.type}-${event.id}`}
                      className="absolute rounded cursor-pointer text-xs overflow-hidden transition-opacity hover:opacity-80"
                      style={{
                        top: event.top,
                        height: event.height,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        marginLeft: overlapIndex > 0 ? '1px' : '4px',
                        marginRight: '4px',
                      }}
                      onClick={() => handleEventClick(event)}
                      data-event="true"
                      data-testid={`weekview-${event.type}-${event.id}`}
                      title={event.title}
                    >
                      <div className={`rounded ${eventColor.light} border-l-2 px-1.5 ${durationMinutes < 15 ? "py-0.5" : "py-1"} h-full`}>
                        <div className="flex flex-col gap-0.5 h-full overflow-hidden justify-start">
                          <div className="flex items-start justify-between gap-1 min-h-0">
                            <p 
                              className={`font-semibold ${durationMinutes < 15 ? "text-[10px]" : "text-xs"} leading-tight flex-1 min-w-0 ${durationMinutes >= 45 ? "truncate" : ""}`}
                              style={durationMinutes >= 15 && durationMinutes < 45 ? { 
                                display: '-webkit-box', 
                                WebkitLineClamp: 2, 
                                WebkitBoxOrient: 'vertical' as const, 
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              } : durationMinutes < 15 ? {
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              } : undefined}
                            >{event.title}</p>
                            {showTimeLabel && (
                              <span className="text-[9px] text-muted-foreground flex-shrink-0 whitespace-nowrap leading-tight ml-1">
                                {startLabel}
                              </span>
                            )}
                          </div>
                          {showPropertyName && (
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {event.propertyName}
                            </p>
                          )}
                          {showLeadName && (
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {event.leadName}
                            </p>
                          )}
                        </div>
                      </div>
                      {showSeeMore && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[9px] text-center py-0.5 cursor-pointer hover:bg-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDayClick) {
                              const eventDate = new Date(event.startTime);
                              onDayClick(eventDate);
                            }
                          }}
                        >
                          +{overlapCount - 3} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {orgMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm mt-4 px-2">
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
