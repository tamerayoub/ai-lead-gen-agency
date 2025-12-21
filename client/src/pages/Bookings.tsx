import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isFuture, isToday, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { MapPin, User, Clock, Home, X, UserCircle, Check, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import ShowingDetailSheet from "@/components/ShowingDetailSheet";
import ShowingEditDialog from "@/components/ShowingEditDialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Showing } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { useLocation } from "wouter";

interface ShowingWithDetails extends Showing {
  propertyName?: string;
  propertyAddress?: string;
  unitNumber?: string;
  leadName?: string;
  leadFirstName?: string;
  leadLastName?: string;
  leadEmail?: string;
  leadPhone?: string;
  agentName?: string;
  eventName?: string;
}

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

export default function Bookings() {
  const [location, setLocation] = useLocation();
  const [selectedShowingId, setSelectedShowingId] = useState<string | null>(null);
  const [isShowingDetailOpen, setIsShowingDetailOpen] = useState(false);
  const [isShowingEditOpen, setIsShowingEditOpen] = useState(false);
  const [editingShowing, setEditingShowing] = useState<Showing | null>(null);
  const [editMode, setEditMode] = useState<"edit" | "reschedule">("edit");
  const nowMarkerRef = useRef<HTMLDivElement>(null);

  // Multi-select filter states (empty array = "all")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Fetch all showings
  const { data: showings = [], isLoading } = useQuery<ShowingWithDetails[]>({
    queryKey: ["/api/showings"],
  });

  // Fetch organization members with profiles
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>>({
    queryKey: ["/api/org/members"],
  });

  // Fetch all properties
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

  // Fetch all leads
  const { data: allLeads = [] } = useQuery<Array<{ id: string; name: string; firstName?: string; lastName?: string; email?: string }>>({
    queryKey: ["/api/leads"],
  });

  // Extract all units from properties
  const allUnits = useMemo(() => {
    const units: Array<{ id: string; unitNumber: string; propertyId: string; propertyName: string }> = [];
    propertiesWithUnits.forEach(property => {
      property.listedUnits.forEach(unit => {
        units.push({
          id: unit.id,
          unitNumber: unit.unitNumber,
          propertyId: unit.propertyId,
          propertyName: property.name
        });
      });
    });
    return units;
  }, [propertiesWithUnits]);

  // Get booked showings (has leadId and not cancelled) - this is the base filter for the timeline
  const bookedShowings = useMemo(() => {
    return showings.filter(showing => {
      const leadId = showing.leadId;
      const hasValidLeadId = leadId != null && leadId !== '' && String(leadId).trim() !== '';
      const isNotCancelled = showing.status !== 'cancelled';
      return hasValidLeadId && isNotCancelled;
    });
  }, [showings]);

  // Helper function to combine date and time into a single Date object
  const getShowingDateTime = (showing: ShowingWithDetails) => {
    return new Date(`${showing.scheduledDate}T${showing.scheduledTime}`);
  };

  // Filter showings based on selected filters
  const filteredShowings = useMemo(() => {
    let filtered = bookedShowings;
    
    // Filter by members (if any selected)
    if (selectedMembers.length > 0) {
      filtered = filtered.filter(showing => {
        const assignedMemberId = (showing as any).assignedTo || (showing as any).assignedToUserId;
        return selectedMembers.includes(assignedMemberId);
      });
    }

    // Filter by properties (if any selected)
    if (selectedProperties.length > 0) {
      filtered = filtered.filter(showing => selectedProperties.includes(showing.propertyId));
    }

    // Filter by units (if any selected)
    if (selectedUnits.length > 0) {
      filtered = filtered.filter(showing => {
        const showingUnitId = (showing as any).unitId;
        return selectedUnits.includes(showingUnitId);
      });
    }

    // Filter by leads (if any selected)
    if (selectedLeads.length > 0) {
      filtered = filtered.filter(showing => selectedLeads.includes(showing.leadId || ''));
    }

    // Filter by date range
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter(showing => {
        const showingDate = parseISO(showing.scheduledDate);
        
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(showingDate, { start: dateRange.from, end: dateRange.to });
        } else if (dateRange.from) {
          return showingDate >= dateRange.from;
        } else if (dateRange.to) {
          return showingDate <= dateRange.to;
        }
        return true;
      });
    }

    return filtered;
  }, [bookedShowings, selectedMembers, selectedProperties, selectedUnits, selectedLeads, dateRange]);

  // Cascading filter options: derive available options based on current filters
  
  // Available members: based on current filtered showings (excluding member filter)
  const availableMemberOptions = useMemo(() => {
    let relevantShowings = bookedShowings;
    
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

    const memberIds = new Set(relevantShowings.map(s => (s as any).assignedTo || (s as any).assignedToUserId).filter(Boolean));
    
    return orgMembers
      .filter(m => memberIds.has(m.id))
      .map(m => ({
        id: m.id,
        label: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email
      }));
  }, [bookedShowings, orgMembers, selectedProperties, selectedUnits, selectedLeads]);

  // Available properties: based on current filtered showings (excluding property filter)
  const availablePropertyOptions = useMemo(() => {
    let relevantShowings = bookedShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => {
        const assignedMemberId = (s as any).assignedTo || (s as any).assignedToUserId;
        return selectedMembers.includes(assignedMemberId);
      });
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
  }, [bookedShowings, properties, selectedMembers, selectedUnits, selectedLeads]);

  // Available units: derived directly from filtered showings (not from allUnits)
  // This ensures units with bookings appear even if they're not "listed" units
  // Always show property name when multiple properties selected or no property filter
  const availableUnitOptions = useMemo(() => {
    let relevantShowings = bookedShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => {
        const assignedMemberId = (s as any).assignedTo || (s as any).assignedToUserId;
        return selectedMembers.includes(assignedMemberId);
      });
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
    // This ensures we capture units with bookings even if they're not in the "listed units" list
    const unitMap = new Map<string, { id: string; unitNumber: string; propertyId: string; propertyName: string }>();
    
    relevantShowings.forEach(showing => {
      const unitId = (showing as any).unitId;
      const unitNumber = showing.unitNumber;
      
      if (unitId && !unitMap.has(unitId)) {
        // Get property name from properties lookup
        const propertyName = propertyNameMap.get(showing.propertyId) || 'Unknown Property';
        
        // Try to get unit number from showing, fallback to allUnits lookup, then extract from title
        let displayUnitNumber = unitNumber;
        if (!displayUnitNumber) {
          // Try to find in allUnits
          const existingUnit = allUnits.find(u => u.id === unitId);
          if (existingUnit) {
            displayUnitNumber = existingUnit.unitNumber;
          } else {
            // Try to extract from showing title (e.g., "Showing for Property - Unit 101")
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
    
    // Determine if we should show property name in unit labels
    // Show property name when: no property filter, or multiple properties selected
    const showPropertyInLabel = selectedProperties.length !== 1;
    
    // Convert map to array and sort by property name, then unit number
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
  }, [bookedShowings, allUnits, properties, selectedMembers, selectedProperties, selectedLeads]);

  // Available leads: based on current filtered showings (excluding lead filter)
  const availableLeadOptions = useMemo(() => {
    let relevantShowings = bookedShowings;
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      relevantShowings = relevantShowings.filter(s => {
        const assignedMemberId = (s as any).assignedTo || (s as any).assignedToUserId;
        return selectedMembers.includes(assignedMemberId);
      });
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
  }, [bookedShowings, allLeads, selectedMembers, selectedProperties, selectedUnits]);

  // Clear invalid selections when options change
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

  // Sort showings chronologically (oldest to newest)
  const sortedShowings = [...filteredShowings].sort((a, b) => {
    const timeA = getShowingDateTime(a).getTime();
    const timeB = getShowingDateTime(b).getTime();
    return timeA - timeB;
  });

  // Clear filters function
  const clearAllFilters = () => {
    setSelectedMembers([]);
    setSelectedProperties([]);
    setSelectedUnits([]);
    setSelectedLeads([]);
    setDateRange(undefined);
  };

  // Check if any filters are active
  const hasActiveFilters = 
    selectedMembers.length > 0 || 
    selectedProperties.length > 0 || 
    selectedUnits.length > 0 || 
    selectedLeads.length > 0 || 
    dateRange?.from || 
    dateRange?.to;

  // Auto-scroll to current time marker on mount
  useEffect(() => {
    if (nowMarkerRef.current && sortedShowings.length > 0) {
      setTimeout(() => {
        nowMarkerRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [isLoading, sortedShowings.length]);

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      cancelled: "bg-red-500 text-white",
      requested: "bg-gray-500 text-white",
      confirmed: "bg-blue-500 text-white",
      approved: "bg-green-500 text-white",
      declined: "bg-yellow-500 text-white",
      // Backward compatibility
      pending: "bg-gray-500 text-white",
      completed: "bg-gray-500 text-white",
    };
    
    return statusColors[status] || "bg-gray-500 text-white";
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      cancelled: "Cancelled",
      requested: "Requested",
      confirmed: "Confirmed",
      approved: "Approved",
      declined: "Decline",
      pending: "Pending",
      completed: "Completed",
    };
    
    return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const TimelineItem = ({ showing, showDateHeader }: { showing: ShowingWithDetails; showDateHeader: boolean }) => {
    const showingDate = getShowingDateTime(showing);
    const now = new Date();
    const isPastShowing = showingDate < now;
    
    return (
      <>
        {showDateHeader && (
          <div className="sticky top-0 z-10 bg-background border-b py-2 px-4">
            <h3 className="font-semibold text-sm" data-testid={`date-header-${showing.scheduledDate}`}>
              {format(showingDate, "EEEE, MMMM d, yyyy")}
            </h3>
          </div>
        )}
        
        <div
          className={`border-b hover-elevate cursor-pointer transition-colors ${
            isPastShowing ? 'opacity-60' : ''
          }`}
          onClick={() => {
            setSelectedShowingId(showing.id);
            setIsShowingDetailOpen(true);
          }}
          data-testid={`booking-${showing.id}`}
        >
          <div className="flex items-start gap-4 p-4">
            <div className="flex-shrink-0 w-20 text-right">
              <div className="font-semibold text-sm" data-testid={`booking-time-${showing.id}`}>
                {format(showingDate, "h:mm a")}
              </div>
              <div className="text-xs text-muted-foreground">
                {showing.durationMinutes} min
              </div>
            </div>
            
            <div className="flex-shrink-0 w-1 bg-border relative">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background" />
            </div>
            
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {showing.eventName ? (
                    <h4 className="font-semibold text-base truncate" data-testid={`booking-title-${showing.id}`}>
                      {showing.eventName}
                    </h4>
                  ) : (
                    <h4 className="font-semibold text-base truncate" data-testid={`booking-title-${showing.id}`}>
                      {showing.title}
                    </h4>
                  )}
                </div>
                <Badge className={`${getStatusColor(showing.status)} flex-shrink-0`} data-testid={`booking-status-${showing.id}`}>
                  {getStatusLabel(showing.status)}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm text-muted-foreground">
                {showing.leadName && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate font-medium" data-testid={`booking-lead-${showing.id}`}>
                      {showing.leadFirstName && showing.leadLastName 
                        ? `${showing.leadFirstName} ${showing.leadLastName}`
                        : showing.leadName}
                    </span>
                  </div>
                )}
                
                {(showing.location || showing.propertyAddress) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {showing.location || (showing.propertyAddress && showing.unitNumber 
                        ? `${showing.propertyAddress} - Unit ${showing.unitNumber}`
                        : showing.propertyAddress)}
                    </span>
                  </div>
                )}
                
                {showing.agentName && (
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate" data-testid={`booking-agent-${showing.id}`}>Agent: {showing.agentName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading bookings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  
  // Find the index where we should insert the "NOW" marker
  const nowIndex = sortedShowings.findIndex(showing => {
    const showingTime = getShowingDateTime(showing);
    return showingTime > now;
  });

  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header + Filters */}
      <div className="sticky top-[-1.5rem] z-30 bg-background">
        <div className="border-b px-6 py-4 bg-background">
          <h1 className="text-2xl font-bold" data-testid="heading-bookings">Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Timeline view of all property showings
          </p>
        </div>

        {/* Filters */}
        <div className="border-b bg-background px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Member Filter - Multi-select */}
            <MultiSelectFilter
              label="Team Members"
              selectedIds={selectedMembers}
              onSelectionChange={setSelectedMembers}
              options={availableMemberOptions}
              placeholder="All Team Members"
              testId="filter-member"
            />

            {/* Property Filter - Multi-select */}
            <MultiSelectFilter
              label="Properties"
              selectedIds={selectedProperties}
              onSelectionChange={setSelectedProperties}
              options={availablePropertyOptions}
              placeholder="All Properties"
              testId="filter-property"
            />

            {/* Unit Filter - Multi-select */}
            <MultiSelectFilter
              label="Units"
              selectedIds={selectedUnits}
              onSelectionChange={setSelectedUnits}
              options={availableUnitOptions}
              placeholder="All Units"
              disabled={availableUnitOptions.length === 0}
              testId="filter-unit"
            />

            {/* Lead Filter - Multi-select */}
            <MultiSelectFilter
              label="Leads"
              selectedIds={selectedLeads}
              onSelectionChange={setSelectedLeads}
              options={availableLeadOptions}
              placeholder="All Leads"
              testId="filter-lead"
            />

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-[240px] justify-start text-left font-normal"
                data-testid="filter-date-range"
              >
                <Clock className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>All Dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearAllFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

          {/* Active Filter Summary */}
          {hasActiveFilters && (
            <div className="mt-2 text-sm text-muted-foreground">
              Showing {sortedShowings.length} of {bookedShowings.length} booking{bookedShowings.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1">
        {sortedShowings.length > 0 ? (
          <div className="bg-background">
            {sortedShowings.map((showing, index) => {
              const showingDate = getShowingDateTime(showing);
              const prevShowing = index > 0 ? sortedShowings[index - 1] : null;
              const prevDate = prevShowing ? getShowingDateTime(prevShowing) : null;
              const showDateHeader = !prevDate || !isSameDay(showingDate, prevDate);
              
              // Insert "NOW" marker between past and future bookings
              const shouldShowNowMarker = index === nowIndex;
              
              return (
                <div key={showing.id}>
                  {shouldShowNowMarker && (
                    <div 
                      ref={nowMarkerRef}
                      className="flex items-center gap-4 px-4 py-3 bg-primary/10 border-y border-primary/30"
                    >
                      <div className="flex-shrink-0 w-20 text-right">
                        <div className="font-bold text-sm text-primary">NOW</div>
                      </div>
                      <div className="flex-1 h-0.5 bg-primary/30"></div>
                    </div>
                  )}
                  <TimelineItem showing={showing} showDateHeader={showDateHeader} />
                </div>
              );
            })}
            
            {/* Show NOW marker at the end if all bookings are in the past */}
            {nowIndex === -1 && sortedShowings.length > 0 && (
              <div 
                ref={nowMarkerRef}
                className="flex items-center gap-4 px-4 py-3 bg-primary/10 border-y border-primary/30"
              >
                <div className="flex-shrink-0 w-20 text-right">
                  <div className="font-bold text-sm text-primary">NOW</div>
                </div>
                <div className="flex-1 h-0.5 bg-primary/30"></div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Bookings Found</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              {hasActiveFilters 
                ? "No bookings match your current filters. Try adjusting or clearing your filters."
                : "There are no booked showings yet. Showings will appear here once leads book appointments."}
            </p>
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={clearAllFilters}
              >
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Showing Detail Sheet */}
      <ShowingDetailSheet
        showingId={selectedShowingId}
        open={isShowingDetailOpen}
        onOpenChange={(open) => {
          setIsShowingDetailOpen(open);
          if (!open) setSelectedShowingId(null);
        }}
        onEdit={(showing, mode) => {
          setEditingShowing(showing);
          setEditMode(mode || "edit");
          setIsShowingDetailOpen(false);
          setIsShowingEditOpen(true);
        }}
      />

      {/* Showing Edit Dialog */}
      <ShowingEditDialog
        showing={editingShowing}
        open={isShowingEditOpen}
        onOpenChange={(open) => {
          setIsShowingEditOpen(open);
          if (!open) setEditingShowing(null);
        }}
        mode={editMode}
      />
    </div>
  );
}
