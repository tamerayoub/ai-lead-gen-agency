import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarPlus, RefreshCw, Trash2, Check } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface CalendarConnection {
  id: string;
  provider: string;
  email: string;
  calendarName: string;
  isActive: boolean;
  createdAt: Date;
}

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
}

interface SchedulePreference {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export default function Schedule() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPreferenceDialogOpen, setIsPreferenceDialogOpen] = useState(false);
  const [newPreference, setNewPreference] = useState({
    dayOfWeek: "monday",
    startTime: "09:00",
    endTime: "17:00",
  });

  // Show success toast when redirected back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    
    if (connected) {
      toast({
        title: "Calendar connected",
        description: `Successfully connected ${connected === "google" ? "Google Calendar" : "calendar"}`,
      });
      
      // Clean up URL by removing query parameter
      window.history.replaceState({}, "", "/schedule");
      
      // Invalidate connections to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
    }
  }, [location, toast]);

  // Fetch calendar connections
  const { data: connections, isLoading: connectionsLoading } = useQuery<CalendarConnection[]>({
    queryKey: ["/api/calendar/connections"],
  });

  // Fetch calendar events for selected date
  const { data: events, isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", selectedDate],
    queryFn: async () => {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await fetch(
        `/api/calendar/events?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`
      );
      return response.json();
    },
  });

  // Fetch schedule preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery<SchedulePreference[]>({
    queryKey: ["/api/schedule/preferences"],
  });

  // Connect Google Calendar
  const connectGoogleCalendar = async () => {
    try {
      const response = await fetch("/api/auth/google-calendar");
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect Google Calendar",
        variant: "destructive",
      });
    }
  };

  // Sync calendar mutation
  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/calendar/sync/${connectionId}`);
      return res.json();
    },
    onSuccess: (data: { success: boolean; syncedCount: number }) => {
      toast({
        title: "Calendar synced",
        description: `Synced ${data.syncedCount} events successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync calendar",
        variant: "destructive",
      });
    },
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("DELETE", `/api/calendar/connections/${connectionId}`);
    },
    onSuccess: () => {
      toast({
        title: "Connection removed",
        description: "Calendar connection has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to remove calendar connection",
        variant: "destructive",
      });
    },
  });

  // Create preference mutation
  const createPreferenceMutation = useMutation({
    mutationFn: async (data: typeof newPreference) => {
      return apiRequest("POST", "/api/schedule/preferences", data);
    },
    onSuccess: () => {
      toast({
        title: "Preference saved",
        description: "Schedule preference has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences"] });
      setIsPreferenceDialogOpen(false);
      setNewPreference({ dayOfWeek: "monday", startTime: "09:00", endTime: "17:00" });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save schedule preference",
        variant: "destructive",
      });
    },
  });

  // Delete preference mutation
  const deletePreferenceMutation = useMutation({
    mutationFn: async (preferenceId: string) => {
      return apiRequest("DELETE", `/api/schedule/preferences/${preferenceId}`);
    },
    onSuccess: () => {
      toast({
        title: "Preference removed",
        description: "Schedule preference has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences"] });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to remove schedule preference",
        variant: "destructive",
      });
    },
  });

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "google":
        return <SiGoogle className="h-4 w-4" />;
      case "outlook":
      case "microsoft":
        return <CalendarPlus className="h-4 w-4" />;
      case "icloud":
      case "apple":
        return <SiApple className="h-4 w-4" />;
      default:
        return <CalendarPlus className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule & Availability</h1>
          <p className="text-muted-foreground">
            Connect your calendars and set preferred showing times for AI-powered scheduling
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar Connections */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Connections</CardTitle>
                <CardDescription>
                  Connect your calendars to sync availability for property showings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : connections && connections.length > 0 ? (
                  <div className="space-y-3">
                    {connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex items-center justify-between rounded-md border p-4"
                      >
                        <div className="flex items-center gap-3">
                          {getProviderIcon(connection.provider)}
                          <div>
                            <p className="font-medium">{connection.calendarName}</p>
                            <p className="text-sm text-muted-foreground">{connection.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {connection.isActive && (
                            <Badge variant="outline" className="gap-1">
                              <Check className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncMutation.mutate(connection.id)}
                            disabled={syncMutation.isPending}
                            data-testid={`button-sync-${connection.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteConnectionMutation.mutate(connection.id)}
                            disabled={deleteConnectionMutation.isPending}
                            data-testid={`button-delete-connection-${connection.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No calendars connected yet
                  </p>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={connectGoogleCalendar}
                    className="gap-2"
                    data-testid="button-connect-google-calendar"
                  >
                    <SiGoogle className="h-4 w-4" />
                    Connect Google Calendar
                  </Button>
                  <Button variant="outline" className="gap-2" disabled data-testid="button-connect-outlook">
                    <CalendarPlus className="h-4 w-4" />
                    Outlook (Coming Soon)
                  </Button>
                  <Button variant="outline" className="gap-2" disabled data-testid="button-connect-icloud">
                    <SiApple className="h-4 w-4" />
                    iCloud (Coming Soon)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Calendar View */}
            <Card>
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>
                  View your availability for {format(selectedDate, "MMMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className="rounded-md border"
                    data-testid="calendar-view"
                  />
                  <div className="flex-1 space-y-2">
                    <h3 className="font-medium">Events</h3>
                    {eventsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : events && events.length > 0 ? (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-md border p-3"
                            data-testid={`event-${event.id}`}
                          >
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {event.isAllDay
                                ? "All day"
                                : `${format(new Date(event.startTime), "h:mm a")} - ${format(
                                    new Date(event.endTime),
                                    "h:mm a"
                                  )}`}
                            </p>
                            {event.location && (
                              <p className="text-sm text-muted-foreground">{event.location}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No events for this day</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Preferences */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Showing Times</CardTitle>
                <CardDescription>Set your preferred times for property showings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {preferencesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : preferences && preferences.length > 0 ? (
                  <div className="space-y-2">
                    {preferences.map((pref) => (
                      <div
                        key={pref.id}
                        className="flex items-center justify-between rounded-md border p-3"
                        data-testid={`preference-${pref.id}`}
                      >
                        <div>
                          <p className="font-medium capitalize">{pref.dayOfWeek}</p>
                          <p className="text-sm text-muted-foreground">
                            {pref.startTime} - {pref.endTime}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePreferenceMutation.mutate(pref.id)}
                          disabled={deletePreferenceMutation.isPending}
                          data-testid={`button-delete-preference-${pref.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground text-sm">
                    No preferences set yet
                  </p>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={() => setIsPreferenceDialogOpen(true)}
                  data-testid="button-add-preference"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add Showing Time
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Preference Dialog */}
      <Dialog open={isPreferenceDialogOpen} onOpenChange={setIsPreferenceDialogOpen}>
        <DialogContent data-testid="dialog-add-preference">
          <DialogHeader>
            <DialogTitle>Add Showing Time Preference</DialogTitle>
            <DialogDescription>
              Set your preferred times for property showings on specific days
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Select
                value={newPreference.dayOfWeek}
                onValueChange={(value) =>
                  setNewPreference({ ...newPreference, dayOfWeek: value })
                }
              >
                <SelectTrigger id="dayOfWeek" data-testid="select-day-of-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <input
                  id="startTime"
                  type="time"
                  value={newPreference.startTime}
                  onChange={(e) =>
                    setNewPreference({ ...newPreference, startTime: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  data-testid="input-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <input
                  id="endTime"
                  type="time"
                  value={newPreference.endTime}
                  onChange={(e) =>
                    setNewPreference({ ...newPreference, endTime: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  data-testid="input-end-time"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreferenceDialogOpen(false)}
              data-testid="button-cancel-preference"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createPreferenceMutation.mutate(newPreference)}
              disabled={createPreferenceMutation.isPending}
              data-testid="button-save-preference"
            >
              {createPreferenceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Preference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
