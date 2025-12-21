import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users, FileText, User } from "lucide-react";
import { format } from "date-fns";
import { getProviderDisplayName } from "@/lib/teamColors";
import { useQuery } from "@tanstack/react-query";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  attendees?: Array<{ email: string; name?: string }> | null;
  isAllDay: boolean;
  status: string;
  userId: string | null;
  provider: string;
}

interface CalendarEventDetailSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CalendarEventDetailSheet({ event, open, onOpenChange }: CalendarEventDetailSheetProps) {
  if (!event) return null;

  // Fetch organization members to display assigned member name
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>>({
    queryKey: ["/api/org/members"],
  });

  const assignedMember = event.userId ? orgMembers.find(m => m.id === event.userId) : null;
  const assignedMemberName = assignedMember
    ? (assignedMember.firstName && assignedMember.lastName 
        ? `${assignedMember.firstName} ${assignedMember.lastName}`
        : assignedMember.email)
    : "Unassigned";

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      confirmed: { variant: "default", label: "Confirmed" },
      tentative: { variant: "secondary", label: "Tentative" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };

    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status };
    return (
      <Badge variant={statusInfo.variant} data-testid="badge-event-status">
        {statusInfo.label}
      </Badge>
    );
  };

  const formatEventTime = () => {
    if (event.isAllDay) {
      return "All day";
    }
    const start = format(new Date(event.startTime), "h:mm a");
    const end = format(new Date(event.endTime), "h:mm a");
    return `${start} - ${end}`;
  };

  const calculateDuration = () => {
    if (event.isAllDay) return null;
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    if (durationMinutes < 60) {
      return `${durationMinutes} minutes`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const duration = calculateDuration();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-event-detail">
        <SheetHeader>
          <SheetTitle data-testid="text-event-title">{event.title}</SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            {getStatusBadge(event.status)}
            <Badge variant="outline" data-testid="badge-event-source">
              {getProviderDisplayName(event.provider)}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Assigned Member */}
          <div className="space-y-3">
            <h4 className="font-medium">Assigned To</h4>
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-event-assigned-member">{assignedMemberName}</span>
            </div>
          </div>

          {/* Date and Time */}
          <div className="border-t pt-6 space-y-3">
            <h4 className="font-medium">Schedule</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-event-date">
                  {format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-event-time">
                  {formatEventTime()}
                  {duration && ` (${duration})`}
                </span>
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <>
              <div className="border-t pt-6 space-y-3">
                <h4 className="font-medium">Location</h4>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span data-testid="text-event-location">{event.location}</span>
                </div>
              </div>
            </>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <>
              <div className="border-t pt-6 space-y-3">
                <h4 className="font-medium">Attendees ({event.attendees.length})</h4>
                <div className="space-y-2">
                  {event.attendees.map((attendee, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 text-sm"
                      data-testid={`attendee-${index}`}
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        {attendee.name && <p className="font-medium">{attendee.name}</p>}
                        <p className="text-muted-foreground">{attendee.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {event.description && (
            <>
              <div className="border-t pt-6 space-y-3">
                <h4 className="font-medium">Description</h4>
                <div className="flex items-start gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-event-description">
                    {event.description}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Info Note */}
          <div className="border-t pt-6">
            <p className="text-xs text-muted-foreground">
              This event is synced from {getProviderDisplayName(event.provider)}. Changes must be made in {getProviderDisplayName(event.provider)}.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
