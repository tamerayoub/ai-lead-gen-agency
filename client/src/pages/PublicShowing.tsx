import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User, Building2, XCircle, CalendarX, Loader2, MessageSquare, Send, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { useState, useEffect, useMemo } from "react";
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
import type { Showing, Property, Lead } from "@shared/schema";

type ActiveSection = "details" | "questions" | "notes" | "timeline";

export default function PublicShowing() {
  const params = useParams<{ showingId: string }>();
  const showingId = params.showingId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("details");
  const [notes, setNotes] = useState("");

  // Fetch showing details
  const { data: showing, isLoading } = useQuery<Showing & { unitId?: string | null }>({
    queryKey: ["/api/showings", showingId],
    enabled: !!showingId,
    queryFn: async () => {
      if (!showingId) return null;
      const response = await apiRequest("GET", `/api/showings/${showingId}`);
      return response.json();
    },
  });

  // Fetch property details
  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", showing?.propertyId],
    enabled: !!showing?.propertyId,
    queryFn: async () => {
      if (!showing?.propertyId) return null;
      const response = await apiRequest("GET", `/api/properties/${showing.propertyId}`);
      return response.json();
    },
  });

  // Fetch lead details if leadId exists
  const { data: lead } = useQuery<Lead>({
    queryKey: ["/api/leads", showing?.leadId],
    enabled: !!showing?.leadId,
    queryFn: async () => {
      if (!showing?.leadId) return null;
      const response = await apiRequest("GET", `/api/leads/${showing.leadId}`);
      return response.json();
    },
  });

  // Fetch property units to display unit number in details
  const { data: propertyUnits = [] } = useQuery<Array<{
    id: string;
    unitNumber: string;
  }>>({
    queryKey: ["/api/properties", showing?.propertyId, "units"],
    enabled: !!showing?.propertyId,
    queryFn: async () => {
      if (!showing?.propertyId) return [];
      const response = await apiRequest("GET", `/api/properties/${showing.propertyId}/units`);
      return response.json();
    },
  });

  // Get the unit number for the showing
  const displayUnit = showing?.unitId 
    ? propertyUnits.find(u => u.id === showing.unitId)
    : propertyUnits.length > 0 ? propertyUnits[0] : null;

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
    enabled: !!showing?.unitId && !!showingId,
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
  });

  // Fetch event description from booking settings
  const { data: rawEventDescription } = useQuery<string | null>({
    queryKey: ["/api/showings", showingId, "event-description"],
    enabled: !!showing?.propertyId && !!showingId,
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

  // Fetch organization members to display assigned member name
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  }>>({
    queryKey: ["/api/org/members"],
    enabled: !!showing?.assignedTo,
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/org/members");
        return response.json();
      } catch (error) {
        console.error("[Assigned Member] Failed to fetch org members:", error);
        return [];
      }
    },
  });

  const assignedMember = showing?.assignedTo ? orgMembers.find(m => m.id === showing.assignedTo) : null;
  const assignedMemberName = assignedMember
    ? (assignedMember.firstName && assignedMember.lastName 
        ? `${assignedMember.firstName} ${assignedMember.lastName}`
        : assignedMember.email)
    : "Unassigned";

  // Fetch audit logs for timeline
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
    enabled: !!showingId,
    queryFn: async () => {
      if (!showingId) return [];
      try {
        const res = await apiRequest("GET", `/api/audit-logs?resource=showings&resourceId=${showingId}`);
        return res.json();
      } catch (error) {
        console.error("[Audit Logs] Failed to fetch:", error);
        return [];
      }
    },
  });

  // Check if showing is in the past
  const isPastShowing = showing ? (() => {
    try {
      const showingDateTime = parseISO(`${showing.scheduledDate}T${showing.scheduledTime}`);
      return isPast(showingDateTime);
    } catch {
      return false;
    }
  })() : false;

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
        description: "The showing has been cancelled and an email has been sent to you",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/showings", showingId] });
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: typeof AlertCircle }> = {
      cancelled: { label: "Cancelled", className: "bg-red-500 text-white hover:bg-red-600", icon: XCircle },
      requested: { label: "Requested", className: "bg-gray-500 text-white hover:bg-gray-600", icon: AlertCircle },
      confirmed: { label: "Confirmed", className: "bg-blue-500 text-white hover:bg-blue-600", icon: CheckCircle },
      approved: { label: "Approved", className: "bg-green-500 text-white hover:bg-green-600", icon: CheckCircle },
      declined: { label: "Decline", className: "bg-yellow-500 text-white hover:bg-yellow-600", icon: XCircle },
      completed: { label: "Completed", className: "bg-gray-500 text-white hover:bg-gray-600", icon: CheckCircle },
      no_show: { label: "No Show", className: "bg-red-500 text-white hover:bg-red-600", icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Reschedule handler
  const handleReschedule = async () => {
    if (!showing) return;
    
    // Navigate directly to unit-level booking page
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
    if (!targetUnitId && showing.propertyId) {
      try {
        const response = await apiRequest("GET", `/api/properties/${showing.propertyId}/units`);
        const units = await response.json();
        if (units && units.length > 0) {
          targetUnitId = units[0].id;
        }
      } catch (error) {
        console.error("[Reschedule] Failed to fetch property units:", error);
      }
    }
    
    // Navigate to unit-level booking page with reschedule parameter
    if (targetUnitId) {
      const bookingUrl = `/book-showing/unit/${targetUnitId}?reschedule=${showing.id}`;
      window.location.href = bookingUrl;
    } else if (showing.propertyId) {
      // Final fallback: if no units found, navigate to property-level
      const bookingUrl = `/book-showing/property/${showing.propertyId}?reschedule=${showing.id}`;
      window.location.href = bookingUrl;
    } else {
      toast({
        title: "Cannot reschedule",
        description: "This showing is not associated with a unit or property. Please contact support.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-4xl w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading showing details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showing) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-4xl w-full">
          <CardHeader>
            <CardTitle>Showing Not Found</CardTitle>
            <CardDescription>
              The showing you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{showing.title}</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(showing.status)}
                  <Badge variant="outline">
                    {showing.showingType?.replace("_", " ") || "in person"}
                  </Badge>
                </div>
              </CardDescription>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-3 mt-6 pb-3 border-b">
            <h3 className="text-sm font-semibold text-muted-foreground">Schedule</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(`${showing.scheduledDate}T${showing.scheduledTime}`), "MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(`${showing.scheduledDate}T${showing.scheduledTime}`), "h:mm a")} ({showing.durationMinutes || 30} minutes)
                </span>
              </div>
            </div>
          </div>

          {/* Reschedule, Cancel, and Send Application Buttons (only for future events, hide Cancel if already cancelled) */}
          {!isPastShowing && (
            <div className="flex gap-2 mt-4 pb-3 border-b">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReschedule}
                className="flex-1"
              >
                <CalendarX className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              {showing.leadId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled
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
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between mt-4 pb-3 border-b">
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
            {showing.leadId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                disabled
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Follow Up
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
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
                          <p className="font-medium">
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
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.address}
                          </p>
                          {displayUnit && (
                            <p className="text-sm text-muted-foreground">
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
                    <div className="flex items-start gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {eventDescription}
                      </p>
                    </div>
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
                    <p className="text-sm text-muted-foreground">{showing.description}</p>
                  </div>
                )}

                {showing.description && <Separator />}

                {/* Assigned To */}
                <div className="space-y-3">
                  <h4 className="font-medium">Assigned To</h4>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{assignedMemberName}</span>
                  </div>
                  {assignedMember?.email && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground ml-7">
                      <span>{assignedMember.email}</span>
                    </div>
                  )}
                  {assignedMember?.phone && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground ml-7">
                      <span>{assignedMember.phone}</span>
                    </div>
                  )}
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
                <p className="text-sm text-muted-foreground">Notes are only visible to property management staff.</p>
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
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => {
        setCancelDialogOpen(open);
        if (!open) {
          setCancelReason("");
        }
      }}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Showing</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for cancelling this showing. An email will be sent to you with this reason.
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
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep It</AlertDialogCancel>
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
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Showing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
