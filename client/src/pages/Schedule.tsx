import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarPlus, RefreshCw, Trash2, Check, Home, ChevronDown, Settings2, ChevronLeft, ChevronRight, Link2, X } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format, addDays, subDays, isToday, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, startOfMonth } from "date-fns";
import { useLocation } from "wouter";
import ShowingCreateDialog from "@/components/ShowingCreateDialog";
import ShowingEditDialog from "@/components/ShowingEditDialog";
import ShowingDetailSheet from "@/components/ShowingDetailSheet";
import CalendarEventDetailSheet from "@/components/CalendarEventDetailSheet";
import EnhancedCalendar from "@/components/EnhancedCalendar";
import DayView from "@/components/DayView";
import WeekView from "@/components/WeekView";
import type { Showing } from "@shared/schema";

// Multi-select filter dropdown component
interface MultiSelectFilterProps {
  label: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  testId: string;
}

function MultiSelectFilter({ 
  label, 
  selectedIds, 
  onSelectionChange, 
  options, 
  placeholder = "All",
  disabled = false,
  testId 
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  
  const displayText = selectedIds.length === 0 
    ? placeholder
    : selectedIds.length === 1 
      ? options.find(o => o.id === selectedIds[0])?.label || placeholder
      : `${selectedIds.length} selected`;

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(s => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between"
          disabled={disabled}
          data-testid={testId}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="p-2">
          <div 
            className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer"
            onClick={selectAll}
          >
            <Checkbox 
              checked={selectedIds.length === 0}
              onCheckedChange={() => selectAll()}
            />
            <span className="text-sm font-medium">{placeholder}</span>
          </div>
          <Separator className="my-1" />
          <ScrollArea className="h-[200px]">
            {options.map((option) => (
              <div
                key={option.id}
                className="flex items-center gap-2 p-2 hover-elevate rounded cursor-pointer"
                onClick={() => toggleOption(option.id)}
              >
                <Checkbox
                  checked={selectedIds.includes(option.id)}
                  onCheckedChange={() => toggleOption(option.id)}
                />
                <span className="text-sm truncate">{option.label}</span>
              </div>
            ))}
            {options.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">No options available</div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CalendarConnection {
  id: string;
  userId: string | null;
  userName?: string;
  provider: string;
  email: string;
  calendarName: string;
  isActive: boolean;
  autoSync: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

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

export default function Schedule() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isShowingCreateOpen, setIsShowingCreateOpen] = useState(false);
  const [selectedShowingId, setSelectedShowingId] = useState<string | null>(null);
  const [isShowingDetailOpen, setIsShowingDetailOpen] = useState(false);
  const [isShowingEditOpen, setIsShowingEditOpen] = useState(false);
  const [editingShowing, setEditingShowing] = useState<Showing | null>(null);
  const [editMode, setEditMode] = useState<"edit" | "reschedule">("edit");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("week");
  
  // Multi-select filter states (empty array = "all")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

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

  // Fetch organization members with profiles (for team member filtering)
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>>({
    queryKey: ["/api/org/members"],
  });

  // Fetch all properties for property filtering in the main calendar view
  const { data: properties = [] } = useQuery<Array<{
    id: string;
    name: string;
    address: string;
  }>>({
    queryKey: ["/api/properties"],
  });

  // Fetch properties with units for unit filtering
  const { data: propertiesWithUnits = [] } = useQuery<Array<{
    id: string;
    name: string;
    listedUnits: Array<{
      id: string;
      unitNumber: string;
      propertyId: string;
    }>;
  }>>({
    queryKey: ["/api/properties/with-listed-units"],
  });

  // Fetch all leads for lead filtering
  const { data: allLeads = [] } = useQuery<Array<{ id: string; name: string; firstName?: string; lastName?: string; email?: string }>>({
    queryKey: ["/api/leads"],
  });

  // Extract all units from properties for the unit filter dropdown
  const units = useMemo(() => {
    const allUnits: Array<{ id: string; unitNumber: string; propertyId: string; propertyName: string }> = [];
    propertiesWithUnits.forEach(property => {
      property.listedUnits.forEach(unit => {
        allUnits.push({
          id: unit.id,
          unitNumber: unit.unitNumber,
          propertyId: unit.propertyId,
          propertyName: property.name
        });
      });
    });
    return allUnits;
  }, [propertiesWithUnits]);

  // Calculate date range based on view mode to ensure all visible dates are covered
  // For week view, include the full week (may span months)
  // For month view, include the full month
  // For day view, include the full month (for context)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  
  // Use the wider range to cover weeks that span months
  const queryStartDate = viewMode === "week" 
    ? (weekStart < monthStart ? weekStart : monthStart)
    : monthStart;
  const queryEndDate = viewMode === "week"
    ? (weekEnd > monthEnd ? weekEnd : monthEnd)
    : monthEnd;
  
  const queryStartStr = format(queryStartDate, "yyyy-MM-dd");
  const queryEndStr = format(queryEndDate, "yyyy-MM-dd");
  const showingsQueryKey = `/api/showings/range?startDate=${queryStartStr}&endDate=${queryEndStr}`;
  
  console.log(`[Schedule] View mode: ${viewMode}, Query range: ${queryStartStr} to ${queryEndStr}`);
  console.log(`[Schedule] Week range: ${format(weekStart, "yyyy-MM-dd")} to ${format(weekEnd, "yyyy-MM-dd")}`);
  console.log(`[Schedule] Month range: ${format(monthStart, "yyyy-MM-dd")} to ${format(monthEnd, "yyyy-MM-dd")}`);
  
  const { data: allShowings, isLoading: showingsLoading, refetch: refetchShowings } = useQuery<Showing[]>({
    queryKey: [showingsQueryKey],
    staleTime: 0, // Always consider data stale to refetch on date change
    refetchOnMount: true, // Refetch when component mounts (e.g., when switching views)
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
  });

  // Refetch showings when date range changes (month or week navigation)
  useEffect(() => {
    queryClient.refetchQueries({ 
      queryKey: [showingsQueryKey],
      exact: true 
    });
  }, [queryStartStr, queryEndStr, showingsQueryKey, viewMode]);

  // Filter showings by selected filters (multi-select)
  const showings = useMemo(() => {
    if (!allShowings) return [];
    console.log(`[Schedule] All showings received: ${allShowings.length}`);
    
    let filtered = allShowings;
    
    // Filter out cancelled showings from calendar view
    const beforeCancelledFilter = filtered.length;
    filtered = filtered.filter(showing => showing.status !== "cancelled");
    console.log(`[Schedule] Filtered out cancelled showings: ${beforeCancelledFilter} -> ${filtered.length}`);
    
    // Filter by members (if any selected)
    if (selectedMembers.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(showing => selectedMembers.includes(showing.assignedTo || ''));
      console.log(`[Schedule] Filtered by members: ${beforeCount} -> ${filtered.length}`);
    }
    
    // Filter by properties (if any selected)
    if (selectedProperties.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(showing => selectedProperties.includes(showing.propertyId));
      console.log(`[Schedule] Filtered by properties: ${beforeCount} -> ${filtered.length}`);
    }
    
    // Filter by units (if any selected)
    if (selectedUnits.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(showing => {
        const showingUnitId = (showing as any).unitId;
        return selectedUnits.includes(showingUnitId);
      });
      console.log(`[Schedule] Filtered by units: ${beforeCount} -> ${filtered.length}`);
    }
    
    // Filter by leads (if any selected)
    if (selectedLeads.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(showing => selectedLeads.includes(showing.leadId || ''));
      console.log(`[Schedule] Filtered by leads: ${beforeCount} -> ${filtered.length}`);
    }
    
    console.log(`[Schedule] Final filtered showings: ${filtered.length}`);
    return filtered;
  }, [allShowings, selectedMembers, selectedProperties, selectedUnits, selectedLeads]);

  // Non-cancelled showings for cascading filter options
  const nonCancelledShowings = useMemo(() => {
    if (!allShowings) return [];
    return allShowings.filter(s => s.status !== 'cancelled');
  }, [allShowings]);

  // Cascading filter options: derive available options based on current filters
  // Available members: based on current filtered showings (excluding member filter)
  const availableMemberOptions = useMemo(() => {
    let relevantShowings = nonCancelledShowings;
    
    // Apply property filter
    if (selectedProperties.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedProperties.includes(s.propertyId));
    }
    // Apply unit filter
    if (selectedUnits.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedUnits.includes((s as any).unitId));
    }
    // Apply lead filter
    if (selectedLeads.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedLeads.includes(s.leadId || ''));
    }

    const memberIds = new Set(relevantShowings.map(s => s.assignedTo).filter(Boolean));
    
    return orgMembers
      .filter(m => memberIds.has(m.id))
      .map(m => ({
        id: m.id,
        label: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email
      }));
  }, [nonCancelledShowings, orgMembers, selectedProperties, selectedUnits, selectedLeads]);

  // Available properties: based on current filtered showings (excluding property filter)
  const availablePropertyOptions = useMemo(() => {
    let relevantShowings = nonCancelledShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedMembers.includes(s.assignedTo || ''));
    }
    // Apply unit filter
    if (selectedUnits.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedUnits.includes((s as any).unitId));
    }
    // Apply lead filter
    if (selectedLeads.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedLeads.includes(s.leadId || ''));
    }

    const propertyIds = new Set(relevantShowings.map(s => s.propertyId).filter(Boolean));
    
    return properties
      .filter(p => propertyIds.has(p.id))
      .map(p => ({
        id: p.id,
        label: p.name
      }));
  }, [nonCancelledShowings, properties, selectedMembers, selectedUnits, selectedLeads]);

  // Available units: derived directly from filtered showings
  // This ensures units with showings appear even if they're not "listed" units
  const availableUnitOptions = useMemo(() => {
    let relevantShowings = nonCancelledShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedMembers.includes(s.assignedTo || ''));
    }
    // Apply property filter
    if (selectedProperties.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedProperties.includes(s.propertyId));
    }
    // Apply lead filter
    if (selectedLeads.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedLeads.includes(s.leadId || ''));
    }

    // Build property name lookup
    const propertyNameMap = new Map(properties.map(p => [p.id, p.name]));
    
    // Build unit options directly from showings that have unitId
    const unitMap = new Map<string, { id: string; unitNumber: string; propertyId: string; propertyName: string }>();
    
    relevantShowings.forEach(showing => {
      const unitId = (showing as any).unitId;
      const unitNumber = (showing as any).unitNumber;
      
      if (unitId && !unitMap.has(unitId)) {
        const propertyName = propertyNameMap.get(showing.propertyId) || 'Unknown Property';
        
        // Try to get unit number from showing, fallback to units lookup
        let displayUnitNumber = unitNumber;
        if (!displayUnitNumber) {
          const existingUnit = units.find(u => u.id === unitId);
          if (existingUnit) {
            displayUnitNumber = existingUnit.unitNumber;
          } else {
            const titleMatch = showing.title?.match(/Unit\s+(\S+)/i);
            displayUnitNumber = titleMatch ? titleMatch[1] : unitId.substring(0, 8);
          }
        }
        
        unitMap.set(unitId, {
          id: unitId,
          unitNumber: displayUnitNumber,
          propertyId: showing.propertyId,
          propertyName: propertyName
        });
      }
    });
    
    // Show property name when no property filter or multiple properties selected
    const showPropertyInLabel = selectedProperties.length !== 1;
    
    return Array.from(unitMap.values())
      .sort((a, b) => {
        const propCompare = a.propertyName.localeCompare(b.propertyName);
        if (propCompare !== 0) return propCompare;
        return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      })
      .map(u => ({
        id: u.id,
        label: showPropertyInLabel 
          ? `${u.propertyName} - Unit ${u.unitNumber}`
          : `Unit ${u.unitNumber}`
      }));
  }, [nonCancelledShowings, units, properties, selectedMembers, selectedProperties, selectedLeads]);

  // Available leads: based on current filtered showings (excluding lead filter)
  const availableLeadOptions = useMemo(() => {
    let relevantShowings = nonCancelledShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedMembers.includes(s.assignedTo || ''));
    }
    // Apply property filter
    if (selectedProperties.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedProperties.includes(s.propertyId));
    }
    // Apply unit filter
    if (selectedUnits.length > 0) {
      relevantShowings = relevantShowings.filter(s => selectedUnits.includes((s as any).unitId));
    }

    const leadIds = new Set(relevantShowings.map(s => s.leadId).filter(Boolean));
    
    return allLeads
      .filter(l => leadIds.has(l.id))
      .map(l => ({
        id: l.id,
        label: l.firstName && l.lastName 
          ? `${l.firstName} ${l.lastName}`
          : l.name || l.email || 'Unknown Lead'
      }));
  }, [nonCancelledShowings, allLeads, selectedMembers, selectedProperties, selectedUnits]);

  // Clear invalid selections when available options change
  useEffect(() => {
    const validMemberIds = new Set(availableMemberOptions.map(m => m.id));
    const invalidMembers = selectedMembers.filter(id => !validMemberIds.has(id));
    if (invalidMembers.length > 0) {
      setSelectedMembers(selectedMembers.filter(id => validMemberIds.has(id)));
    }
  }, [availableMemberOptions, selectedMembers]);

  useEffect(() => {
    const validPropertyIds = new Set(availablePropertyOptions.map(p => p.id));
    const invalidProperties = selectedProperties.filter(id => !validPropertyIds.has(id));
    if (invalidProperties.length > 0) {
      setSelectedProperties(selectedProperties.filter(id => validPropertyIds.has(id)));
    }
  }, [availablePropertyOptions, selectedProperties]);

  useEffect(() => {
    const validUnitIds = new Set(availableUnitOptions.map(u => u.id));
    const invalidUnits = selectedUnits.filter(id => !validUnitIds.has(id));
    if (invalidUnits.length > 0) {
      setSelectedUnits(selectedUnits.filter(id => validUnitIds.has(id)));
    }
  }, [availableUnitOptions, selectedUnits]);

  useEffect(() => {
    const validLeadIds = new Set(availableLeadOptions.map(l => l.id));
    const invalidLeads = selectedLeads.filter(id => !validLeadIds.has(id));
    if (invalidLeads.length > 0) {
      setSelectedLeads(selectedLeads.filter(id => validLeadIds.has(id)));
    }
  }, [availableLeadOptions, selectedLeads]);

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedMembers([]);
    setSelectedProperties([]);
    setSelectedUnits([]);
    setSelectedLeads([]);
  };

  // Check if any filters are active
  const hasActiveFilters = 
    selectedMembers.length > 0 || 
    selectedProperties.length > 0 || 
    selectedUnits.length > 0 || 
    selectedLeads.length > 0;

  // Fetch calendar events for the same date range as showings
  // Auto-refresh every 30 seconds to show webhook-synced events without manual refresh
  const eventsStartTime = new Date(queryStartDate);
  eventsStartTime.setHours(0, 0, 0, 0);
  const eventsEndTime = new Date(queryEndDate);
  eventsEndTime.setHours(23, 59, 59, 999);
  // For calendar events, we filter by first selected member only (if any)
  const eventsQueryKey = selectedMembers.length === 0
    ? `/api/calendar/events?startTime=${eventsStartTime.toISOString()}&endTime=${eventsEndTime.toISOString()}`
    : `/api/calendar/events?startTime=${eventsStartTime.toISOString()}&endTime=${eventsEndTime.toISOString()}&memberId=${selectedMembers[0]}`;
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<CalendarEvent[]>({
    queryKey: [eventsQueryKey],
    staleTime: 0, // Always consider data stale to refetch on date change
    refetchOnMount: true, // Refetch when component mounts
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Refetch events when date range, view mode, or member filter changes
  useEffect(() => {
    queryClient.refetchQueries({ 
      queryKey: [eventsQueryKey],
      exact: true 
    });
  }, [eventsQueryKey, viewMode]);

  // Filter showings and events for the selected day (for detail view)
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  console.log(`[Schedule] Filtering for selected date: ${selectedDateStr}`);
  console.log(`[Schedule] Available showings dates:`, showings?.map(s => s.scheduledDate) || []);
  const selectedDayShowings = showings?.filter(s => {
    const matches = s.scheduledDate === selectedDateStr;
    if (matches) {
      console.log(`[Schedule] ✅ Showing ${s.id} matches date ${selectedDateStr}: time=${s.scheduledTime}, assignedTo=${s.assignedTo}`);
    }
    return matches;
  }) || [];
  console.log(`[Schedule] Selected day showings count: ${selectedDayShowings.length}`);
  const selectedDayEvents = events?.filter(e => {
    const eventDate = format(new Date(e.startTime), "yyyy-MM-dd");
    return eventDate === selectedDateStr;
  }) || [];

  // Derive selected event for detail view
  const selectedEvent = useMemo(() => {
    if (!selectedEventId || !events) return null;
    return events.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, events]);

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

  // Toggle auto-sync mutation
  const toggleAutoSyncMutation = useMutation({
    mutationFn: async ({ connectionId, autoSync }: { connectionId: string; autoSync: boolean }) => {
      const res = await apiRequest("PATCH", `/api/calendar/connections/${connectionId}/auto-sync`, { autoSync });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.autoSync ? "Auto-sync enabled" : "Auto-sync disabled",
        description: variables.autoSync 
          ? "Calendar will sync automatically every 15 minutes"
          : "Calendar will only sync when you click the sync button",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/connections"] });
    },
    onError: () => {
      toast({
        title: "Failed to toggle auto-sync",
        description: "There was an error updating the auto-sync setting",
        variant: "destructive",
      });
    },
  });

  // Track which connections are currently being synced
  const [syncingConnectionIds, setSyncingConnectionIds] = useState<Set<string>>(new Set());

  // Sync calendar mutation
  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      setSyncingConnectionIds(prev => new Set([...prev, connectionId]));
      try {
        const res = await apiRequest("POST", `/api/calendar/sync/${connectionId}`);
        const data = await res.json();
        return { connectionId, data };
      } catch (error: any) {
        // Re-throw with more context
        const errorMessage = error?.message || "Failed to sync calendar";
        throw new Error(errorMessage);
      }
    },
    onSuccess: ({ connectionId, data }: { connectionId: string; data: { success: boolean; syncedCount: number; warnings?: string[]; message?: string } }) => {
      if (data.warnings && data.warnings.length > 0) {
        toast({
          title: "Calendar synced with warnings",
          description: data.message || `Synced ${data.syncedCount} events, but ${data.warnings.length} failed`,
          variant: "default",
        });
      } else {
        toast({
          title: "Calendar synced",
          description: `Synced ${data.syncedCount} events successfully`,
        });
      }
      // Invalidate all calendar event queries
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/calendar/events?")
      });
    },
    onError: (error: any) => {
      // Extract error message from various possible error formats
      let errorMessage = "Failed to sync calendar";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.error("Sync error:", error);
      
      toast({
        title: "Sync failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSettled: (data, error, connectionId) => {
      // Always remove connection from syncing set, regardless of success or error
      // Use the connectionId from variables (3rd parameter) which is always available
      setSyncingConnectionIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
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
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/calendar/events?")
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to remove calendar connection",
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
        {/* Header with Calendar Connections Trigger */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Schedule & Calendar</h1>
            <p className="text-muted-foreground">
              View your calendar, manage showings, and sync with Google Calendar
            </p>
          </div>
          
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsConnectionsOpen(!isConnectionsOpen)}
            data-testid="button-toggle-connections"
          >
            <Settings2 className="h-4 w-4" />
            Calendar Settings
            <ChevronDown className={`h-4 w-4 transition-transform ${isConnectionsOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {/* Calendar Connections - Collapsible */}
        <Collapsible open={isConnectionsOpen} onOpenChange={setIsConnectionsOpen}>
          <CollapsibleContent>
            <Card data-testid="card-calendar-connections">
              <CardHeader>
                <CardTitle>Calendar Connections</CardTitle>
                <CardDescription>
                  Connect and manage your calendars. Enable auto-sync to keep events up-to-date automatically.
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
                        data-testid={`connection-${connection.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getProviderIcon(connection.provider)}
                          <div className="flex-1">
                            <p className="font-medium">{connection.calendarName}</p>
                            <p className="text-sm text-muted-foreground">
                              {connection.userName ? `${connection.userName} – ${connection.email}` : connection.email}
                            </p>
                            {connection.lastSyncedAt && (
                              <p className="text-xs text-muted-foreground">
                                Last synced: {format(new Date(connection.lastSyncedAt), "MMM d, h:mm a")}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Auto-sync toggle */}
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`auto-sync-${connection.id}`} className="text-sm cursor-pointer">
                              Auto-sync
                            </Label>
                            <Switch
                              id={`auto-sync-${connection.id}`}
                              checked={connection.autoSync}
                              onCheckedChange={(checked) => 
                                toggleAutoSyncMutation.mutate({ 
                                  connectionId: connection.id, 
                                  autoSync: checked 
                                })
                              }
                              disabled={toggleAutoSyncMutation.isPending}
                              data-testid={`switch-auto-sync-${connection.id}`}
                            />
                          </div>

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
                            disabled={syncingConnectionIds.has(connection.id)}
                            data-testid={`button-sync-${connection.id}`}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingConnectionIds.has(connection.id) ? "animate-spin" : ""}`} />
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
          </CollapsibleContent>
        </Collapsible>

        {/* Main Content */}
        <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Calendar</CardTitle>
                    <CardDescription>
                      View Google Calendar events and Lead2Lease showings
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Team Member Filter - multi-select cascading */}
                    <MultiSelectFilter
                      label="Team Members"
                      selectedIds={selectedMembers}
                      onSelectionChange={setSelectedMembers}
                      options={availableMemberOptions}
                      placeholder="All Team Members"
                      testId="select-team-member-filter"
                    />

                    {/* Property Filter - multi-select cascading */}
                    <MultiSelectFilter
                      label="Properties"
                      selectedIds={selectedProperties}
                      onSelectionChange={setSelectedProperties}
                      options={availablePropertyOptions}
                      placeholder="All Properties"
                      testId="select-property-filter"
                    />

                    {/* Unit Filter - multi-select cascading */}
                    <MultiSelectFilter
                      label="Units"
                      selectedIds={selectedUnits}
                      onSelectionChange={setSelectedUnits}
                      options={availableUnitOptions}
                      placeholder="All Units"
                      disabled={availableUnitOptions.length === 0}
                      testId="select-unit-filter"
                    />

                    {/* Lead Filter - multi-select cascading */}
                    <MultiSelectFilter
                      label="Leads"
                      selectedIds={selectedLeads}
                      onSelectionChange={setSelectedLeads}
                      options={availableLeadOptions}
                      placeholder="All Leads"
                      testId="select-lead-filter"
                    />

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="gap-1"
                        data-testid="button-clear-filters"
                      >
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    
                    {viewMode === "month" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(startOfMonth(subMonths(selectedDate, 1)))}
                          data-testid="button-previous-month"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-sm font-medium px-3 py-1 rounded-md border bg-muted/30" data-testid="text-month-display">
                          {format(selectedDate, "MMMM yyyy")}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(startOfMonth(addMonths(selectedDate, 1)))}
                          data-testid="button-next-month"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {viewMode === "week" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}
                          data-testid="button-previous-week"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-sm font-medium px-3 py-1 rounded-md border bg-muted/30" data-testid="text-week-range">
                          {format(startOfWeek(selectedDate, { weekStartsOn: 0 }), "MMM d")} - {format(endOfWeek(selectedDate, { weekStartsOn: 0 }), "MMM d, yyyy")}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
                          data-testid="button-next-week"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {viewMode === "day" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                          data-testid="button-previous-day"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={isToday(selectedDate) ? "default" : "outline"}
                          onClick={() => setSelectedDate(new Date())}
                          data-testid="button-today"
                        >
                          Today
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                          data-testid="button-next-day"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "week" | "day")}>
                  <TabsList className="mb-4" data-testid="tabs-calendar-view">
                    <TabsTrigger value="month" data-testid="tab-month-view">Month</TabsTrigger>
                    <TabsTrigger value="week" data-testid="tab-week-view">Week</TabsTrigger>
                    <TabsTrigger value="day" data-testid="tab-day-view">Day</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="month" className="mt-0">
                    {showingsLoading || eventsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <EnhancedCalendar
                        showings={showings || []}
                        events={events || []}
                        selectedDate={selectedDate}
                        orgMembers={orgMembers}
                        hideNavigation={true}
                        onDateSelect={(date) => {
                          setSelectedDate(date);
                          setViewMode("day");
                        }}
                        onMonthChange={(date) => {
                          setSelectedDate(date);
                        }}
                        onShowingClick={(showingId) => {
                          setSelectedShowingId(showingId);
                          setIsShowingDetailOpen(true);
                        }}
                        onEventClick={(eventId) => {
                          setSelectedEventId(eventId);
                          setIsEventDetailOpen(true);
                        }}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="week" className="mt-0">
                    {showingsLoading || eventsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <WeekView
                        selectedDate={selectedDate}
                        showings={showings || []}
                        events={events || []}
                        orgMembers={orgMembers}
                        onShowingClick={(showingId) => {
                          setSelectedShowingId(showingId);
                          setIsShowingDetailOpen(true);
                        }}
                        onEventClick={(eventId) => {
                          setSelectedEventId(eventId);
                          setIsEventDetailOpen(true);
                        }}
                        onDayClick={(date) => {
                          setSelectedDate(date);
                          setViewMode("day");
                        }}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="day" className="mt-0">
                    {showingsLoading || eventsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">
                            {format(selectedDate, "EEEE, MMMM d, yyyy")}
                          </h3>
                          <Button
                            size="sm"
                            onClick={() => setIsShowingCreateOpen(true)}
                            data-testid="button-schedule-showing-day"
                          >
                            <Home className="h-4 w-4 mr-2" />
                            Schedule Showing
                          </Button>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                          <DayView
                            date={selectedDate}
                            showings={selectedDayShowings}
                            events={selectedDayEvents}
                            orgMembers={orgMembers}
                            onShowingClick={(showingId) => {
                              setSelectedShowingId(showingId);
                              setIsShowingDetailOpen(true);
                            }}
                            onEventClick={(eventId) => {
                              setSelectedEventId(eventId);
                              setIsEventDetailOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

        {/* Showing Create Dialog */}
        <ShowingCreateDialog
          open={isShowingCreateOpen}
          onOpenChange={setIsShowingCreateOpen}
          preselectedDate={selectedDate}
        />

        {/* Showing Detail Sheet */}
        {selectedShowingId && (
          <ShowingDetailSheet
            open={isShowingDetailOpen}
            onOpenChange={setIsShowingDetailOpen}
            showingId={selectedShowingId}
            onEdit={(showing, mode = "edit") => {
              setEditingShowing(showing);
              setEditMode(mode);
              setIsShowingEditOpen(true);
              setIsShowingDetailOpen(false);
            }}
          />
        )}

        {/* Showing Edit Dialog */}
        <ShowingEditDialog
          open={isShowingEditOpen}
          onOpenChange={setIsShowingEditOpen}
          showing={editingShowing}
          mode={editMode}
        />

        {/* Calendar Event Detail Sheet */}
        {selectedEvent && (
          <CalendarEventDetailSheet
            open={isEventDetailOpen}
            onOpenChange={(open) => {
              setIsEventDetailOpen(open);
              if (!open) {
                setSelectedEventId(null);
              }
            }}
            event={selectedEvent}
          />
        )}
      </div>
    </div>
  );
}
