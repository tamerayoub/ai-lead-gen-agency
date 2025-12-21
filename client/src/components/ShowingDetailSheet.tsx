import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, User, Building2, Trash2, Edit, CheckCircle, XCircle, AlertCircle, MoreVertical, CalendarX, MessageSquare, Send } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import type { Showing, Property, Lead } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

interface ShowingDetailSheetProps {
  showingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (showing: Showing, mode?: "edit" | "reschedule") => void;
}

type ActiveSection = "details" | "questions" | "notes" | "timeline";

export default function ShowingDetailSheet({ 
  showingId, 
  open, 
  onOpenChange,
  onEdit 
}: ShowingDetailSheetProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>("details");
  const [notes, setNotes] = useState("");

  // Fetch showing details
  // Note: The response may include unitId even though it's not in the Showing type
  const { data: showing, isLoading } = useQuery<Showing & { unitId?: string | null }>({
    queryKey: ["/api/showings", showingId],
    enabled: !!showingId && open,
  });

  // Close sheet if showing becomes null/undefined after being deleted
  useEffect(() => {
    if (open && !isLoading && showingId && !showing) {
      onOpenChange(false);
    }
  }, [showing, isLoading, open, showingId, onOpenChange]);

  // Fetch property details
  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", showing?.propertyId],
    enabled: !!showing?.propertyId,
  });

  // Fetch lead details if leadId exists
  const { data: lead } = useQuery<Lead>({
    queryKey: ["/api/leads", showing?.leadId],
    enabled: !!showing?.leadId,
  });

  // Fetch property units to display unit number in details
  const { data: propertyUnits = [] } = useQuery<Array<{
    id: string;
    unitNumber: string;
  }>>({
    queryKey: ["/api/properties", showing?.propertyId, "units"],
    queryFn: async () => {
      if (!showing?.propertyId) return [];
      const response = await apiRequest("GET", `/api/properties/${showing.propertyId}/units`);
      return response.json();
    },
    enabled: !!showing?.propertyId,
  });

  // Get the unit number for the showing
  const displayUnit = showing?.unitId 
    ? propertyUnits.find(u => u.id === showing.unitId)
    : propertyUnits.length > 0 ? propertyUnits[0] : null;

  // Fetch event description from booking settings
  const { data: rawEventDescription } = useQuery<string | null>({
    queryKey: ["/api/showings", showingId, "event-description"],
    queryFn: async () => {
      if (!showing?.propertyId) return null;
      
      // Try to get unit-level event description first
      if (showing.unitId) {
        try {
          const unitSettings = await apiRequest("GET", `/api/units/${showing.unitId}/scheduling`);
          const unitData = await unitSettings.json();
          if (unitData?.customEventDescription) {
            return unitData.customEventDescription;
          }
        } catch (error) {
          console.error("[Event Description] Failed to fetch unit settings:", error);
        }
      }
      
      // Fall back to property-level event description
      try {
        const propertySettings = await apiRequest("GET", `/api/properties/${showing.propertyId}/scheduling-settings`);
        const propertyData = await propertySettings.json();
        return propertyData?.eventDescription || null;
      } catch (error) {
        console.error("[Event Description] Failed to fetch property settings:", error);
        return null;
      }
    },
    enabled: !!showing?.propertyId && !!showingId && open,
  });

  // Get the full unit data for variable replacement
  const { data: fullUnitData } = useQuery<{
    id: string;
    unitNumber: string;
    bedrooms: number;
    bathrooms: string;
    monthlyRent: string | null;
    deposit: string | null;
  } | null>({
    queryKey: ["/api/units", showing?.unitId],
    queryFn: async () => {
      if (!showing?.unitId) return null;
      try {
        const response = await apiRequest("GET", `/api/units/${showing.unitId}`);
        return response.json();
      } catch (error) {
        console.error("[Event Description] Failed to fetch unit data:", error);
        return null;
      }
    },
    enabled: !!showing?.unitId && !!showingId && open,
  });

  // Replace variables in event description with actual values
  const eventDescription = useMemo(() => {
    if (!rawEventDescription) return null;
    if (!property) return rawEventDescription;
    
    // Get unit data (use fullUnitData if available, otherwise fall back to displayUnit)
    const unit = fullUnitData || (displayUnit ? {
      unitNumber: displayUnit.unitNumber,
      bedrooms: 0,
      bathrooms: '',
      monthlyRent: null,
      deposit: null,
    } : null);
    
    if (!unit) return rawEventDescription;
    
    // Format property amenities as comma-separated list
    const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
      ? property.amenities.join(', ')
      : '';
    
    // Format property address
    const propertyAddressStr = property.address || '';
    
    // Format unit rent with currency
    const unitRentStr = unit.monthlyRent 
      ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
      : '';
    
    // Format security deposit with currency
    const securityDepositStr = unit.deposit
      ? `$${parseFloat(unit.deposit).toLocaleString()}`
      : '';
    
    // Define safe replacement mapping with all available variables
    const variables: Record<string, string> = {
      '{unit_number}': unit.unitNumber || '',
      '{bedrooms}': unit.bedrooms?.toString() || '',
      '{bathrooms}': unit.bathrooms || '',
      '{unit_rent}': unitRentStr,
      '{security_deposit}': securityDepositStr,
      '{property_amenities}': propertyAmenitiesStr,
      '{property_address}': propertyAddressStr,
      '{property_name}': property.name || ''
    };
    
    // Replace each variable
    let result = rawEventDescription;
    for (const [placeholder, value] of Object.entries(variables)) {
      // Escape regex special characters in placeholder for safe replacement
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
    }
    
    return result;
  }, [rawEventDescription, property, fullUnitData, displayUnit]);

  // Initialize notes from showing feedbackNotes
  useEffect(() => {
    if (showing?.feedbackNotes !== undefined) {
      setNotes(showing.feedbackNotes || "");
    }
  }, [showing?.feedbackNotes]);

  // Fetch audit logs for this showing
  const { data: auditLogs = [] } = useQuery<Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    userId: string | null;
    createdAt: string;
    details: any;
  }>>({
    queryKey: ["/api/audit-logs", showingId],
    enabled: !!showingId && open,
    queryFn: async () => {
      if (!showingId) return [];
      const res = await apiRequest("GET", `/api/audit-logs?resource=showings&resourceId=${showingId}`);
      return res.json();
    },
  });

  // Fetch organization members to display assigned member name
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>>({
    queryKey: ["/api/org/members"],
  });

  const assignedMember = showing?.assignedTo ? orgMembers.find(m => m.id === showing.assignedTo) : null;
  const assignedMemberName = assignedMember
    ? (assignedMember.firstName && assignedMember.lastName 
        ? `${assignedMember.firstName} ${assignedMember.lastName}`
        : assignedMember.email)
    : "Unassigned";

  // Check if showing is in the past
  const isPastShowing = showing ? (() => {
    try {
      const showingDateTime = parseISO(`${showing.scheduledDate}T${showing.scheduledTime}`);
      return isPast(showingDateTime);
    } catch {
      return false;
    }
  })() : false;

  // Delete showing mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/showings/${showingId}`);
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Showing deleted",
        description: "The showing has been successfully deleted",
      });
      // Invalidate all showing queries (both direct and range queries)
      queryClient.invalidateQueries({ queryKey: ["/api/showings"], exact: false });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/showings/range?")
      });
      // Invalidate available-times queries so the booking page reflects the updated availability
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && (
          query.queryKey[0].includes("/api/public/units/") && query.queryKey[0].includes("/available-times") ||
          query.queryKey[0].includes("/api/public/properties/") && query.queryKey[0].includes("/available-times")
        )
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to delete showing",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/showings/${showingId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "The showing status has been updated",
      });
      // Invalidate all showing queries (both direct and range queries)
      queryClient.invalidateQueries({ queryKey: ["/api/showings"], exact: false });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/showings/range?")
      });
      // Invalidate available-times queries when status changes (especially if cancelled)
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && (
          query.queryKey[0].includes("/api/public/units/") && query.queryKey[0].includes("/available-times") ||
          query.queryKey[0].includes("/api/public/properties/") && query.queryKey[0].includes("/available-times")
        )
      });
    },
    onError: () => {
      toast({
        title: "Failed to update status",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (notesText: string) => {
      if (!showingId) throw new Error("No showing ID");
      const res = await apiRequest("PATCH", `/api/showings/${showingId}`, { feedbackNotes: notesText });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notes updated",
        description: "Your notes have been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/showings", showingId] });
    },
    onError: () => {
      toast({
        title: "Failed to update notes",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotes = () => {
    if (showingId) {
      updateNotesMutation.mutate(notes);
    }
  };

  // Cancel showing mutation
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("PATCH", `/api/showings/${showingId}`, { 
        status: "cancelled",
        cancellationReason: reason 
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Showing cancelled",
        description: "The showing has been cancelled and an email has been sent to the lead",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/showings"], exact: false });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/showings/range?")
      });
      setCancelDialogOpen(false);
      setCancelReason("");
    },
    onError: () => {
      toast({
        title: "Failed to cancel showing",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Navigate to full lead profile
  const handleLeadClick = () => {
    if (showing?.leadId) {
      setLocation(`/leads/${showing.leadId}`);
      onOpenChange(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: typeof AlertCircle }> = {
      cancelled: { label: "Cancelled", className: "bg-red-500 text-white hover:bg-red-600", icon: XCircle },
      requested: { label: "Requested", className: "bg-gray-500 text-white hover:bg-gray-600", icon: AlertCircle },
      confirmed: { label: "Confirmed", className: "bg-blue-500 text-white hover:bg-blue-600", icon: CheckCircle },
      approved: { label: "Approved", className: "bg-green-500 text-white hover:bg-green-600", icon: CheckCircle },
      declined: { label: "Decline", className: "bg-yellow-500 text-white hover:bg-yellow-600", icon: XCircle },
      // Keep these for backward compatibility but they won't show in dropdown
      completed: { label: "Completed", className: "bg-gray-500 text-white hover:bg-gray-600", icon: CheckCircle },
      no_show: { label: "No Show", className: "bg-red-500 text-white hover:bg-red-600", icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} gap-1`} data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  if (!showing) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-showing-detail">
          <SheetHeader>
            <div className="flex items-start justify-between gap-4 pr-12">
              <div className="flex-1">
                <SheetTitle data-testid="text-showing-title">{showing.title}</SheetTitle>
                <SheetDescription>
                  <div className="flex items-center gap-2 mt-2">
                    {showing.status === "cancelled" ? (
                      // When cancelled, show status badge without dropdown
                      <div>
                        {getStatusBadge(showing.status)}
                      </div>
                    ) : (
                      // When not cancelled, show status badge with dropdown
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="cursor-pointer">
                            {getStatusBadge(showing.status)}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate("cancelled")}
                            disabled={updateStatusMutation.isPending || showing.status === "cancelled"}
                          >
                            Cancelled
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate("requested")}
                            disabled={updateStatusMutation.isPending || showing.status === "requested"}
                          >
                            Requested
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate("confirmed")}
                            disabled={updateStatusMutation.isPending || showing.status === "confirmed"}
                          >
                            Confirmed
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate("approved")}
                            disabled={updateStatusMutation.isPending || showing.status === "approved"}
                          >
                            Approved
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate("declined")}
                            disabled={updateStatusMutation.isPending || showing.status === "declined"}
                          >
                            Decline
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Badge variant="outline" data-testid="badge-showing-type">
                      {showing.showingType.replace("_", " ")}
                    </Badge>
                  </div>
                </SheetDescription>
              </div>
            </div>
            {/* 3-dot menu aligned with close button (only show for cancelled or past events) */}
            {(showing.status === "cancelled" || isPastShowing) && (
              <div className="absolute right-12 top-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      data-testid="button-showing-menu"
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                      data-testid="menu-item-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </SheetHeader>

          <div className="space-y-4 py-4">

            {/* Schedule Section */}
            <div className="space-y-3 pb-3 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground">Schedule</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-showing-date">
                    {format(new Date(`${showing.scheduledDate}T${showing.scheduledTime}`), "PPP")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-showing-time">
                    {format(new Date(`${showing.scheduledDate}T${showing.scheduledTime}`), "h:mm a")} ({showing.durationMinutes} minutes)
                  </span>
                </div>
              </div>
            </div>

            {/* Reschedule, Cancel, and Send Application Buttons (only for future events, hide Cancel if already cancelled) */}
            {!isPastShowing && (
              <div className="flex gap-2 pb-3 border-b">
                {onEdit && showing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!showing) return;
                      
                      // Navigate directly to unit-level booking page
                      // First try to get unitId from the showing object
                      let targetUnitId = showing.unitId || (showing as any).unitId;
                      
                      // If not found, fetch the showing details again to get the unitId
                      if (!targetUnitId && showing.id) {
                        try {
                          const response = await apiRequest("GET", `/api/showings/${showing.id}`);
                          const fullShowing = await response.json();
                          targetUnitId = fullShowing.unitId;
                        } catch (error) {
                          console.error("[Reschedule] Failed to fetch showing details:", error);
                        }
                      }
                      
                      // If still no unitId, try to get the first unit from the property
                      // This ensures we always go to unit-level, not property-level
                      if (!targetUnitId && showing.propertyId) {
                        try {
                          const response = await apiRequest("GET", `/api/properties/${showing.propertyId}/units`);
                          const units = await response.json();
                          if (units && units.length > 0) {
                            // Use the first unit to navigate to unit-level
                            targetUnitId = units[0].id;
                          }
                        } catch (error) {
                          console.error("[Reschedule] Failed to fetch property units:", error);
                        }
                      }
                      
                      // Navigate to unit-level booking page with reschedule parameter
                      if (targetUnitId) {
                        const bookingUrl = `/book-showing/unit/${targetUnitId}?reschedule=${showing.id}`;
                        setLocation(bookingUrl);
                        onOpenChange(false);
                      } else if (showing.propertyId) {
                        // Final fallback: if no units found, navigate to property-level
                        const bookingUrl = `/book-showing/property/${showing.propertyId}?reschedule=${showing.id}`;
                        setLocation(bookingUrl);
                        onOpenChange(false);
                      } else {
                        toast({
                          title: "Cannot reschedule",
                          description: "This showing is not associated with a unit or property. Please contact support.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="flex-1"
                    data-testid="button-reschedule"
                  >
                    <CalendarX className="h-4 w-4 mr-2" />
                    Reschedule
                  </Button>
                )}
                {showing.leadId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (showing.leadId) {
                        setLocation(`/leads/${showing.leadId}`);
                        onOpenChange(false);
                      }
                    }}
                    className="flex-1"
                    data-testid="button-send-application"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Application
                  </Button>
                )}
                {showing.status !== "cancelled" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancelDialogOpen(true)}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {/* Floating Navigation Bar */}
            <div className="sticky top-0 z-10 bg-background border-b rounded-t-lg -mx-6 px-6 py-2 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={activeSection === "details" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection("details")}
                    className="text-xs"
                  >
                    Details
                  </Button>
                  <Button
                    type="button"
                    variant={activeSection === "questions" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection("questions")}
                    className="text-xs"
                  >
                    Questions
                  </Button>
                  <Button
                    type="button"
                    variant={activeSection === "notes" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection("notes")}
                    className="text-xs"
                  >
                    Notes
                  </Button>
                  <Button
                    type="button"
                    variant={activeSection === "timeline" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection("timeline")}
                    className="text-xs"
                  >
                    Timeline
                  </Button>
                </div>
                {/* Follow Up Button */}
                {showing.leadId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLeadClick}
                    className="text-xs"
                    data-testid="button-follow-up"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Follow Up
                  </Button>
                )}
              </div>
            </div>

            {/* Section Content */}
            <div className="min-h-[400px]">
              {activeSection === "details" && (
                <div className="space-y-6">
                  {/* Lead - First Field */}
                  {lead && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Lead</h4>
                      <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p 
                              className="font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={handleLeadClick}
                              data-testid="text-lead-name"
                            >
                              {lead.name || "No name"}
                            </p>
                            {lead.email && <p className="text-sm text-muted-foreground">{lead.email}</p>}
                            {lead.phone && <p className="text-sm text-muted-foreground">{lead.phone}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Property */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Property</h4>
                    {property ? (
                      <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium" data-testid="text-property-name">{property.name}</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-property-address">
                              {property.address}
                            </p>
                            {displayUnit && (
                              <p className="text-sm text-muted-foreground" data-testid="text-unit-number">
                                Unit {displayUnit.unitNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Property information not available</p>
                    )}
                  </div>

                  <Separator />

                  {/* Event Description */}
                  {eventDescription && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Event Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-event-description">
                        {eventDescription}
                      </p>
                    </div>
                  )}

                  {eventDescription && <Separator />}

                  {/* Access Method */}
                  {showing.accessMethod && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Access</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Method:</span> {showing.accessMethod.replace("_", " ")}</p>
                        {showing.lockboxCode && (
                          <p><span className="font-medium">Lockbox Code:</span> {showing.lockboxCode}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {showing.accessMethod && <Separator />}

                  {/* Description */}
                  {showing.description && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-showing-description">{showing.description}</p>
                    </div>
                  )}

                  {showing.description && <Separator />}

                  {/* Assigned To - Moved to Bottom */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Assigned To</h4>
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span data-testid="text-showing-assigned-member">{assignedMemberName}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "questions" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Questions section - Coming soon</p>
                </div>
              )}

              {activeSection === "notes" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="showing-notes">Notes</Label>
                    <Textarea
                      id="showing-notes"
                      placeholder="Add notes about this showing..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={10}
                      className="resize-none"
                      data-testid="textarea-showing-notes"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={updateNotesMutation.isPending}
                        data-testid="button-save-notes"
                      >
                        {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "timeline" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {/* Event Created */}
                    {showing && (
                      <div className="flex gap-3 pb-3 border-b">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Event Created</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(showing.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This showing was created
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Event Updated (if different from created) */}
                    {showing && showing.updatedAt !== showing.createdAt && (
                      <div className="flex gap-3 pb-3 border-b">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Event Updated</p>
                            <p className="text-xs text-muted-foreground">
                              {showing.updatedAt ? format(new Date(showing.updatedAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This showing was last modified
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Status Changes */}
                    {showing?.status === "cancelled" && (
                      <div className="flex gap-3 pb-3 border-b">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-destructive mt-2" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Event Cancelled</p>
                            <p className="text-xs text-muted-foreground">
                              {showing.updatedAt ? format(new Date(showing.updatedAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This showing was cancelled
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Audit Logs */}
                    {auditLogs.length > 0 && auditLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 pb-3 border-b">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-muted-foreground mt-2" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium capitalize">
                              {log.action.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.createdAt ? format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}
                            </p>
                          </div>
                          {log.details && typeof log.details === 'object' && log.details.message && (
                            <p className="text-xs text-muted-foreground">
                              {log.details.message}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!showing || (auditLogs.length === 0 && showing.updatedAt === showing.createdAt)) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No additional activity recorded
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Showing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this showing? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) {
          setCancelReason("");
        }
      }}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation" className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Showing</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for cancelling this showing. An email will be sent to the lead with this reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Enter the reason for cancelling this showing..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-cancel-reason"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancel">No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!cancelReason.trim()) {
                  toast({
                    title: "Reason required",
                    description: "Please provide a reason for cancelling",
                    variant: "destructive",
                  });
                  return;
                }
                cancelMutation.mutate(cancelReason.trim());
              }}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Showing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
