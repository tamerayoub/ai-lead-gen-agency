import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Home } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import type { Showing } from "@shared/schema";
import { getMemberColor, getShowingColor } from "@/lib/teamColors";

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

interface EnhancedCalendarProps {
  showings: Showing[];
  events: CalendarEvent[];
  selectedDate: Date;
  orgMembers: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  onDateSelect: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  hideNavigation?: boolean;
  onShowingClick: (showingId: string) => void;
  onEventClick?: (eventId: string) => void;
}

export default function EnhancedCalendar({
  showings,
  events,
  selectedDate,
  orgMembers,
  onDateSelect,
  onMonthChange,
  hideNavigation = false,
  onShowingClick,
  onEventClick,
}: EnhancedCalendarProps) {
  // Use selectedDate to determine current month (no separate state)
  const currentMonth = selectedDate;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Get all days to display (including padding days from prev/next month)
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay()); // Start from Sunday

  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay())); // End on Saturday

  const daysToDisplay = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    // Navigate to next month without switching views
    if (onMonthChange) {
      onMonthChange(startOfMonth(newMonth));
    } else {
      onDateSelect(startOfMonth(newMonth));
    }
  };
  
  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    // Navigate to previous month without switching views
    if (onMonthChange) {
      onMonthChange(startOfMonth(newMonth));
    } else {
      onDateSelect(startOfMonth(newMonth));
    }
  };
  
  const goToToday = () => {
    // Navigate to today without switching views
    if (onMonthChange) {
      onMonthChange(new Date());
    } else {
      onDateSelect(new Date());
    }
  };

  // Get showings and events for a specific day
  const getItemsForDay = (day: Date) => {
    const dayShowings = showings.filter((showing) =>
      isSameDay(new Date(showing.scheduledDate + 'T00:00:00'), day)
    );
    const dayEvents = events.filter((event) =>
      isSameDay(new Date(event.startTime), day)
    );
    return { dayShowings, dayEvents };
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      {!hideNavigation && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={prevMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-px bg-border">
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="bg-card p-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Calendar cells */}
          {daysToDisplay.map((day, dayIdx) => {
            const { dayShowings, dayEvents } = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dayIdx}
                className={`
                  bg-card min-h-[120px] p-2 cursor-pointer hover-elevate
                  ${!isCurrentMonth ? "opacity-40" : ""}
                  ${isSelected ? "ring-2 ring-primary" : ""}
                `}
                onClick={() => onDateSelect(day)}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      text-sm font-medium
                      ${isToday ? "flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>
                  {(dayShowings.length > 0 || dayEvents.length > 0) && (
                    <span className="text-xs text-muted-foreground">
                      {dayShowings.length + dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Display events and showings */}
                <div className="space-y-1">
                  {/* Calendar Events - Color coded by team member */}
                  {dayEvents.slice(0, 2).map((event) => {
                    const eventColor = getMemberColor(event.userId, orgMembers);
                    return (
                      <div
                        key={event.id}
                        className={`text-xs p-1.5 rounded ${eventColor.light} border-l-2 hover-elevate cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEventClick) {
                            onEventClick(event.id);
                          }
                        }}
                        data-testid={`calendar-event-${event.id}`}
                        title={`${event.title} - ${event.isAllDay ? 'All day' : format(new Date(event.startTime), 'h:mm a')}`}
                      >
                        <div className="flex items-center gap-1 overflow-hidden">
                          <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Lead2Lease Showings - Color coded by assigned member */}
                  {dayShowings.slice(0, 2).map((showing) => {
                    const showingColor = showing.assignedTo ? getMemberColor(showing.assignedTo, orgMembers) : getShowingColor();
                    return (
                      <div
                        key={showing.id}
                        className={`text-xs p-1.5 rounded ${showingColor.light} border-l-2 hover-elevate cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowingClick(showing.id);
                        }}
                        data-testid={`calendar-showing-${showing.id}`}
                        title={`${showing.title} - ${formatTime(showing.scheduledTime)}`}
                      >
                        <div className="flex items-center gap-1 overflow-hidden">
                          <Home className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{showing.title}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show "+N more" if there are more items than displayed */}
                  {dayShowings.length + dayEvents.length > 4 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{(dayShowings.length + dayEvents.length) - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend - Team Member Colors */}
      {orgMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
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
          {orgMembers.length > 5 && (
            <span className="text-muted-foreground text-xs">+{orgMembers.length - 5} more</span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-500" />
            <span className="text-muted-foreground">Unassigned</span>
          </div>
        </div>
      )}
    </div>
  );
}
