import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Calendar, MapPin, Clock, CheckCircle2, Loader2, Home, ArrowLeft, ChevronRight, ChevronLeft, Building2, Bath, BedDouble, AlertCircle, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format, parseISO, addMonths, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";
import { ThemeProvider } from "@/components/ThemeProvider";
import "react-day-picker/dist/style.css";

// Helper function to convert 24-hour time to 12-hour format
function formatTimeTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Custom caption with arrow navigation beside the month/year text
function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();

  const handlePreviousClick = () => {
    if (previousMonth) {
      goToMonth(previousMonth);
    }
  };

  const handleNextClick = () => {
    if (nextMonth) {
      goToMonth(nextMonth);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 mb-2">
      <button
        type="button"
        onClick={handlePreviousClick}
        disabled={!previousMonth}
        className="p-2 hover-elevate active-elevate-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-prev-month"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="font-semibold text-base min-w-[140px] text-center">
        {format(displayMonth, 'MMMM yyyy')}
      </div>
      <button
        type="button"
        onClick={handleNextClick}
        disabled={!nextMonth}
        className="p-2 hover-elevate active-elevate-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-next-month"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

interface TimeSlot {
  date: string;
  time: string;
  score: number;
  reason: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  units?: number;
  timezone?: string;
  coverPhoto?: string | null;
  description?: string | null;
  amenities?: string[] | null;
}

function PublicBookingContent() {
  const params = useParams<{ propertyId?: string; unitId?: string; id?: string }>();
  const [location, setLocation] = useLocation();
  const { propertyId, unitId, id: showingId } = params;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // If we're on /showing/:id route, fetch the showing and redirect
  const { data: showingForRedirect } = useQuery<{
    id: string;
    propertyId: string;
    unitId: string | null;
  }>({
    queryKey: ["/api/showings", showingId],
    queryFn: async () => {
      if (!showingId) return null;
      const response = await apiRequest("GET", `/api/showings/${showingId}`);
      return response.json();
    },
    enabled: !!showingId && !propertyId && !unitId,
  });

  // Redirect to appropriate booking page when showing is fetched
  useEffect(() => {
    if (showingForRedirect && showingId) {
      if (showingForRedirect.unitId) {
        // Redirect to unit-level booking page with reschedule parameter
        setLocation(`/book-showing/unit/${showingForRedirect.unitId}?reschedule=${showingId}`);
      } else {
        // Redirect to property-level booking page with reschedule parameter
        setLocation(`/book-showing/property/${showingForRedirect.propertyId}?reschedule=${showingId}`);
      }
    }
  }, [showingForRedirect, showingId, setLocation]);
  
  // Check for reschedule query parameter - use window.location for the full URL with query string
  // (wouter's useLocation only returns the pathname, not the query string)
  const { rescheduleShowingId, isRescheduling } = useMemo(() => {
    // Use window.location.search to get the query string (e.g., "?reschedule=...")
    const searchParams = new URLSearchParams(window.location.search);
    const rescheduleId = searchParams.get('reschedule') || showingId; // Also check if showingId is in URL
    // Also check the full URL for "reschedule" anywhere
    const fullUrl = window.location.href.toLowerCase();
    const urlContainsReschedule = fullUrl.includes('reschedule');
    return {
      rescheduleShowingId: rescheduleId,
      isRescheduling: !!rescheduleId || urlContainsReschedule
    };
  }, [location, showingId]); // Still depend on location to re-run when path changes
  
  // Debug: Log reschedule status
  useEffect(() => {
    if (rescheduleShowingId) {
      console.log('[PublicBooking] Rescheduling detected:', rescheduleShowingId, 'isRescheduling:', isRescheduling);
      console.log('[PublicBooking] URL location:', location);
      console.log('[PublicBooking] isUnitBooking:', unitId ? true : false);
    }
  }, [rescheduleShowingId, isRescheduling, location, unitId]);
  
  const [step, setStep] = useState<"units" | "prequalify" | "prequalify-failed" | "select" | "form" | "success">(unitId ? "select" : "units");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  
  // Pre-qualification state
  const [qualificationAnswers, setQualificationAnswers] = useState<Record<string, any>>({});
  const [qualificationPassed, setQualificationPassed] = useState(false);
  const [qualificationMessage, setQualificationMessage] = useState("");
  
  // Store booking response data for success page
  const [bookingResponse, setBookingResponse] = useState<{
    assignedMember?: { name: string; email: string; phone: string | null } | null;
    eventName?: string | null;
  } | null>(null);
  
  // State for selected unit in property-level booking
  // Initialize with unitId from URL if present (for unit-level bookings)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(unitId || null);
  
  // Sync selectedUnitId with URL unitId when it changes (e.g., when user clicks a different unit)
  useEffect(() => {
    if (unitId) {
      setSelectedUnitId(unitId);
    }
  }, [unitId]);
  
  // Fetch showing details if rescheduling
  const { data: rescheduleShowing } = useQuery<{
    id: string;
    propertyId: string;
    unitId: string | null;
    leadId: string | null;
    scheduledDate: string;
    scheduledTime: string;
    status: string;
    lead?: {
      name: string;
      email: string | null;
      phone: string | null;
    };
  }>({
    queryKey: ["/api/showings", rescheduleShowingId],
    queryFn: async () => {
      if (!rescheduleShowingId) return null;
      const response = await apiRequest("GET", `/api/showings/${rescheduleShowingId}`);
      return response.json();
    },
    enabled: !!rescheduleShowingId,
  });
  
  // Pre-fill form data when rescheduling
  useEffect(() => {
    if (rescheduleShowing && rescheduleShowing.lead) {
      setFormData({
        name: rescheduleShowing.lead.name || "",
        email: rescheduleShowing.lead.email || "",
        phone: rescheduleShowing.lead.phone || "",
      });
      // Set selected date and time
      if (rescheduleShowing.scheduledDate) {
        setSelectedDate(new Date(rescheduleShowing.scheduledDate));
      }
      if (rescheduleShowing.scheduledTime) {
        setSelectedSlot({
          date: rescheduleShowing.scheduledDate,
          time: rescheduleShowing.scheduledTime,
          score: 0,
          reason: "",
        });
      }
      // If rescheduling and we're on property-level view, redirect to unit-level if showing has unitId
      // This ensures reschedule goes directly to the correct unit's booking page
      // Only redirect if we have a valid unitId that matches the showing
      if (rescheduleShowing.unitId && !unitId && rescheduleShowing.unitId) {
        // Verify the unitId is valid before redirecting
        // If we're on property level but showing has a unitId, navigate directly to that unit
        const url = `/book-showing/unit/${rescheduleShowing.unitId}?reschedule=${rescheduleShowingId}`;
        window.location.href = url;
        return;
      }
      // If we're on a unit-level page (unitId in URL), use that unitId
      // The URL unitId always takes precedence - don't override with rescheduleShowing.unitId
      if (unitId) {
        setSelectedUnitId(unitId);
        // If on unit-level page and we have date/time, start at select step
        if (rescheduleShowing.scheduledDate && rescheduleShowing.scheduledTime) {
          setStep("select");
        }
      } else {
        // On property-level with no unitId, start at "units" step
        setStep("units");
      }
    }
  }, [rescheduleShowing, unitId, rescheduleShowingId]);

  // Determine which endpoint to use based on URL params
  const isUnitBooking = !!unitId;
  const bookingId = unitId || propertyId;
  const apiEndpoint = isUnitBooking 
    ? `/api/public/units/${unitId}/available-times`
    : `/api/public/properties/${propertyId}/available-times`;

  // Fetch property/unit details (public endpoint)
  const { data: propertyData, isLoading: propertyLoading, error: propertyError } = useQuery<{ 
    property: Property; 
    unit?: {
      id: string;
      unitNumber: string;
      bedrooms: number;
      bathrooms: string;
      squareFeet?: number;
      monthlyRent?: string;
      description?: string;
      amenities?: string[];
      coverPhoto?: string | null;
    };
    units?: Array<{
      id: string;
      unitNumber: string;
      bedrooms: number;
      bathrooms: string;
      squareFeet?: number;
      monthlyRent?: string;
      description?: string;
      amenities?: string[];
      coverPhoto?: string | null;
    }>;
    organization: {
      name: string;
      logo?: string | null;
      profileImage?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
    };
    eventDuration: number;
    eventDescription: string;
    eventName?: string | null;
    timeSlots: TimeSlot[] 
  }>({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Property or unit not found");
        }
        throw new Error(`Failed to fetch booking data: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!bookingId,
    retry: false, // Don't retry on 404 errors
  });

  // Determine effective unit ID for qualification check
  const effectiveUnitIdForQualification = unitId || selectedUnitId;

  // Fetch qualification requirements for the unit (if applicable)
  interface QualificationQuestion {
    id: string;
    type: "text" | "number" | "boolean" | "select";
    question: string;
    required: boolean;
    options?: string[];
    order: number;
  }

  interface QualificationRequirements {
    required: boolean;
    templateId?: string;
    introMessage?: string;
    questions?: QualificationQuestion[];
    allowRetry?: boolean;
    showResultsImmediately?: boolean;
    message?: string;
  }

  const { data: qualificationReqs, isLoading: qualificationLoading } = useQuery<QualificationRequirements>({
    queryKey: ["/api/public/units", effectiveUnitIdForQualification, "qualification"],
    queryFn: async () => {
      const response = await fetch(`/api/public/units/${effectiveUnitIdForQualification}/qualification`);
      if (!response.ok) {
        return { required: false };
      }
      return response.json();
    },
    enabled: !!effectiveUnitIdForQualification && !isRescheduling,
  });

  // Mutation for submitting pre-qualification answers
  const qualifyMutation = useMutation({
    mutationFn: async (data: { answers: Record<string, any>; leadEmail: string; leadName: string; leadPhone?: string }) => {
      const response = await fetch(`/api/public/units/${effectiveUnitIdForQualification}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: qualificationReqs?.templateId,
          answers: data.answers,
          leadEmail: data.leadEmail,
          leadName: data.leadName,
          leadPhone: data.leadPhone,
        }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || `Pre-qualification failed: ${response.statusText}`);
      }
      return responseData;
    },
    onSuccess: (data: any) => {
      if (data.passed) {
        setQualificationPassed(true);
        setQualificationMessage(data.message || "You have passed the pre-qualification.");
        setStep("select"); // Proceed to booking
        toast({
          title: "Pre-Qualification Passed",
          description: "You can now proceed to book a showing.",
        });
      } else {
        setQualificationPassed(false);
        setQualificationMessage(data.message || "Unfortunately, you did not pass the pre-qualification.");
        setStep("prequalify-failed");
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Pre-Qualification Error",
        description: error.message,
      });
    },
  });

  // Check if pre-qualification is required when unit is selected
  const handleProceedToBooking = () => {
    if (qualificationReqs?.required && !qualificationPassed && !isRescheduling) {
      setStep("prequalify");
    } else {
      setStep("select");
    }
  };

  // Reset qualification state when unit or template changes
  useEffect(() => {
    setQualificationPassed(false);
    setQualificationAnswers({});
    setQualificationMessage("");
  }, [effectiveUnitIdForQualification, qualificationReqs?.templateId]);

  // Auto-check for pre-qualification when page loads with a unit
  useEffect(() => {
    if (qualificationReqs && !qualificationLoading && step === "select" && !isRescheduling) {
      if (qualificationReqs.required && !qualificationPassed) {
        setStep("prequalify");
      }
    }
  }, [qualificationReqs, qualificationLoading, step, qualificationPassed, isRescheduling]);

  // Handle qualification form submission
  const handleQualificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) {
      toast({
        variant: "destructive",
        title: "Required Fields",
        description: "Please provide your name and email to continue.",
      });
      return;
    }
    qualifyMutation.mutate({
      answers: qualificationAnswers,
      leadEmail: formData.email,
      leadName: formData.name,
      leadPhone: formData.phone,
    });
  };

  // Group time slots by date (runs even if propertyData is null)
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, TimeSlot[]>();
    if (propertyData?.timeSlots) {
      console.log("[PublicBooking] Received time slots:", propertyData.timeSlots.length);
      propertyData.timeSlots.forEach(slot => {
        const existing = grouped.get(slot.date) || [];
        existing.push(slot);
        grouped.set(slot.date, existing);
      });
      console.log("[PublicBooking] Grouped slots by date:", Array.from(grouped.keys()));
    } else {
      console.log("[PublicBooking] No time slots in propertyData:", propertyData);
    }
    return grouped;
  }, [propertyData]);

  // Get available dates for calendar highlighting
  const availableDates = useMemo(() => {
    return Array.from(slotsByDate.keys()).map(dateStr => parseISO(dateStr));
  }, [slotsByDate]);

  // Get time slots for selected date (sorted in ascending order - earliest time first)
  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slots = slotsByDate.get(dateStr) || [];
    // Sort by time in ascending order (earliest first, going down)
    return [...slots].sort((a, b) => {
      const timeA = a.time.split(':').map(Number);
      const timeB = b.time.split(':').map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      return minutesA - minutesB; // Ascending order
    });
  }, [selectedDate, slotsByDate]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset slot selection when date changes
  };

  // Book showing mutation (or update if rescheduling)
  const bookMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; date: string; time: string }) => {
      if (isRescheduling && rescheduleShowingId) {
        // Update existing showing
        const updateData: any = {
          scheduledDate: data.date,
          scheduledTime: data.time,
        };
        
        // Only include status if it needs to be changed from cancelled
        if (rescheduleShowing?.status === "cancelled") {
          updateData.status = "requested";
        }
        
        console.log("[PublicBooking] Rescheduling showing:", {
          showingId: rescheduleShowingId,
          updateData,
          originalDate: rescheduleShowing?.scheduledDate,
          originalTime: rescheduleShowing?.scheduledTime,
          newDate: data.date,
          newTime: data.time
        });
        
        const res = await apiRequest("PATCH", `/api/showings/${rescheduleShowingId}`, updateData);
        const result = await res.json();
        console.log("[PublicBooking] Reschedule response:", result);
        return result;
      } else {
        // Create new showing
        // For property-level bookings, use the selected unit
        const targetUnitId = unitId || selectedUnitId;
        if (!targetUnitId) {
          throw new Error('No unit selected');
        }
        
        const bookEndpoint = `/api/public/units/${targetUnitId}/book`;
        console.log("[PublicBooking] Making booking request to:", bookEndpoint);
        console.log("[PublicBooking] Booking data:", data);
        
        const res = await fetch(bookEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        console.log("[PublicBooking] Response status:", res.status);
        console.log("[PublicBooking] Response ok:", res.ok);
        
        if (!res.ok) {
          const error = await res.json();
          console.error("[PublicBooking] Booking error response:", error);
          throw new Error(error.message || 'Failed to book showing');
        }
        const result = await res.json();
        console.log("[PublicBooking] Booking success response:", result);
        return result;
      }
    },
    onSuccess: (data: any) => {
      // Store booking response data for success page
      if (data?.showing) {
        setBookingResponse({
          assignedMember: data.showing.assignedMember || null,
          eventName: data.showing.eventName || null,
        });
      }
      
      // Invalidate queries to refresh bookings and calendar views
      queryClient.invalidateQueries({ queryKey: ["/api/showings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/showings/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      
      setStep("success");
      toast({
        title: isRescheduling ? "Showing Rescheduled!" : "Showing Booked!",
        description: isRescheduling 
          ? "The showing has been rescheduled successfully." 
          : "You'll receive a confirmation email shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: isRescheduling ? "Reschedule Failed" : "Booking Failed",
        description: error.message,
      });
    },
  });

  const handleContinueToForm = () => {
    if (!selectedSlot) {
      toast({
        variant: "destructive",
        title: "No Time Selected",
        description: "Please select a time slot to continue.",
      });
      return;
    }
    setStep("form");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    bookMutation.mutate({
      ...formData,
      date: selectedSlot.date,
      time: selectedSlot.time,
    });
  };

  // Loading state with skeleton
  if (propertyLoading) {
    return (
      <TooltipProvider>
        <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
          <Card className="h-full w-full max-w-7xl flex overflow-hidden shadow-lg">
            {/* Left Panel Skeleton */}
            <div className="w-80 border-r bg-card flex flex-col p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-6 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
            
            {/* Center Content Skeleton */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Loading property details...</p>
              </div>
            </div>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  // Show error state (check this before checking if data is null)
  if (propertyError) {
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Property Not Found</CardTitle>
            <CardDescription>
              {propertyError.message || "The property you're looking for doesn't exist or is no longer available."}
              <br />
              <br />
              This could mean:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>The unit is not listed for bookings</li>
                <li>Booking is disabled for this unit or property</li>
                <li>The unit or property has been deleted</li>
              </ul>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show not found if data is null after loading
  if (!propertyLoading && !propertyData) {
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Property Not Found</CardTitle>
            <CardDescription>
              The property you're looking for doesn't exist or is no longer available.
              <br />
              <br />
              This could mean:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>The unit is not listed for bookings</li>
                <li>Booking is disabled for this unit or property</li>
                <li>The unit or property has been deleted</li>
              </ul>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!propertyData) {
    return null;
  }
  
  const { property, unit, units, organization, eventDuration, eventDescription, eventName } = propertyData;
  
  // Get propertyId from various sources (for unit-level bookings, it's not in URL)
  // Use propertyId from URL, rescheduleShowing, or propertyData
  const effectivePropertyId = propertyId || rescheduleShowing?.propertyId || property?.id;
  
  // Build full address
  const fullAddress = [
    property.address,
    property.city,
    property.state,
    property.zipCode
  ].filter(Boolean).join(', ');

  // Get the display unit (either from direct unit booking or selected unit in property booking)
  // When on unit-level page (unitId in URL), always use the unit from API response
  // When on property-level page, use selectedUnitId or unitId from URL to find unit in units array
  const displayUnit = isUnitBooking 
    ? unit  // On unit-level page, use the unit from API (should match URL unitId)
    : (selectedUnitId && units?.find(u => u.id === selectedUnitId)) || (unitId && units?.find(u => u.id === unitId));

  // Units selection screen (for property-level bookings)
  if (step === "units" && !isUnitBooking && units && units.length > 0) {
    // Get organization initials for avatar fallback
    const orgInitialsForUnits = organization?.name
      ? organization.name.split(' ').map((word: string) => word[0]).join('').substring(0, 2).toUpperCase()
      : 'PM';
    
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
          <div className="border-b px-6 py-4 flex-shrink-0">
            {/* Organization Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b">
              {organization?.logo || organization?.profileImage ? (
                <img
                  src={organization.logo || organization.profileImage || ''}
                  alt={organization?.name || "Property Management"}
                  className="h-12 w-12 rounded-lg object-cover border flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg flex-shrink-0">
                  {orgInitialsForUnits}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-base truncate">{organization?.name || "Property Management"}</h2>
                <p className="text-xs text-muted-foreground">Property Management Company</p>
                {organization && (organization.email || organization.phone) && (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {organization.email && (
                      <div className="flex items-center gap-1">
                        <span>Email: {organization.email}</span>
                      </div>
                    )}
                    {organization.phone && (
                      <div className="flex items-center gap-1">
                        <span>Phone: {organization.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Select a Unit</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which unit you'd like to schedule a showing for
            </p>
          </div>
          <div className="flex-1 overflow-hidden p-6 min-h-0">
            {/* Two-column layout starting under "Select a Unit" */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-0 h-full">
              {/* Left Column: Property Details - Sticky */}
              <div className="lg:sticky lg:top-0 lg:h-full lg:overflow-y-auto pr-6">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl" data-testid="text-property-name">{property.name}</CardTitle>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <CardDescription className="text-sm" data-testid="text-address">{fullAddress}</CardDescription>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Property Cover Photo Display */}
                    {property.coverPhoto && (
                      <div className="overflow-hidden rounded-lg border">
                        <img
                          src={property.coverPhoto}
                          alt={property.name}
                          className="w-full h-64 object-cover"
                        />
                      </div>
                    )}
                    {!property.coverPhoto && (
                      <div className="w-full h-64 rounded-lg border bg-muted flex items-center justify-center">
                        <Home className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Property Details Section */}
                    <div className="pt-4 border-t space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Property Details</h4>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Property:</span>
                          <span className="font-medium">{property.name}</span>
                        </div>
                        
                        {units && units.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Available Units:</span>
                            <span className="font-medium">{units.length} {units.length === 1 ? 'unit' : 'units'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description Section */}
                    {property.description && (
                      <div className="pt-4 border-t space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Description</h4>
                        <p className="text-sm text-foreground leading-relaxed">{property.description}</p>
                      </div>
                    )}

                    {/* Amenities Section */}
                    {property.amenities && property.amenities.length > 0 && (
                      <div className="pt-4 border-t space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Amenities</h4>
                        <div className="flex flex-wrap gap-2">
                          {property.amenities.map((amenity: string, index: number) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-muted rounded-md text-sm text-foreground"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Vertical Divider Line */}
              <div className="hidden lg:block w-px bg-border mx-6"></div>
              
              {/* Right Column: Units to Select - Scrollable */}
              <div className="h-full flex flex-col pl-6 pr-4 min-h-0 overflow-hidden">
                <Card className="h-full flex flex-col min-h-0 overflow-hidden">
                  <CardHeader className="pb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Home className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Available Units</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      Click on a unit to schedule a showing
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 overflow-y-auto min-h-0 pr-4">
                    <div className="grid gap-4">
                {units.map((availableUnit) => {
                  // Use unit cover photo, fallback to property cover photo
                  const unitCoverPhoto = availableUnit.coverPhoto || property.coverPhoto;
                  return (
                  <Card 
                    key={availableUnit.id}
                    className={`hover-elevate active-elevate-2 cursor-pointer transition-all ${
                      selectedUnitId === availableUnit.id ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                    onClick={() => {
                      // Always navigate to unit-level booking page when clicking a unit
                      // This ensures we have the correct route with unit ID in the path
                      if (rescheduleShowingId) {
                        // When rescheduling, navigate to unit-level page with reschedule parameter
                        const url = `/book-showing/unit/${availableUnit.id}?reschedule=${rescheduleShowingId}`;
                        window.location.href = url;
                      } else {
                        // For new bookings, navigate to unit-level page
                        const url = `/book-showing/unit/${availableUnit.id}`;
                        window.location.href = url;
                      }
                    }}
                    data-testid={`card-unit-${availableUnit.unitNumber}`}
                  >
                    {/* Unit Cover Photo */}
                    {unitCoverPhoto ? (
                      <div className="w-full h-32 overflow-hidden rounded-t-lg">
                        <img
                          src={unitCoverPhoto}
                          alt={`Unit ${availableUnit.unitNumber}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center rounded-t-lg">
                        <Home className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Unit {availableUnit.unitNumber}</span>
                        {availableUnit.monthlyRent && (
                          <span className="text-lg font-semibold text-primary">
                            ${parseFloat(availableUnit.monthlyRent).toLocaleString()}/mo
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
                          <BedDouble className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {availableUnit.bedrooms} {availableUnit.bedrooms === 1 ? 'bed' : 'beds'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
                          <Bath className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {availableUnit.bathrooms} {availableUnit.bathrooms === '1' ? 'bath' : 'baths'}
                          </span>
                        </div>

                        {availableUnit.squareFeet && (
                          <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {availableUnit.squareFeet.toLocaleString()} sq ft
                            </span>
                          </div>
                        )}
                      </div>

                      {availableUnit.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {availableUnit.description}
                        </p>
                      )}

                      {availableUnit.amenities && availableUnit.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {availableUnit.amenities.slice(0, 3).map((amenity, idx) => (
                            <span 
                              key={idx}
                              className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                            >
                              {amenity}
                            </span>
                          ))}
                          {availableUnit.amenities.length > 3 && (
                            <span className="text-xs text-muted-foreground px-2 py-1">
                              +{availableUnit.amenities.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Success screen
  if (step === "success") {
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">Showing Booked Successfully!</CardTitle>
            <CardDescription className="text-center">
              Your showing for {property.name} on {selectedSlot?.date} at {selectedSlot?.time ? formatTimeTo12Hour(selectedSlot.time) : ''} has been confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              {bookingResponse?.eventName && (
                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <span>{bookingResponse.eventName}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{selectedSlot?.date} at {selectedSlot?.time ? formatTimeTo12Hour(selectedSlot.time) : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{property.address}</span>
              </div>
              {bookingResponse?.assignedMember && (
                <div className="pt-2 mt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">Your Contact:</div>
                  <div className="text-sm font-medium">{bookingResponse.assignedMember.name}</div>
                  {bookingResponse.assignedMember.email && (
                    <div className="text-xs text-muted-foreground">Email: {bookingResponse.assignedMember.email}</div>
                  )}
                  {bookingResponse.assignedMember.phone && (
                    <div className="text-xs text-muted-foreground">Phone: {bookingResponse.assignedMember.phone}</div>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Check your email ({formData.email}) for confirmation and details.
            </p>
            {/* Back button to return to unit booking page */}
            {(unitId || selectedUnitId) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const targetUnitId = unitId || selectedUnitId;
                  if (targetUnitId) {
                    window.location.href = `/book-showing/unit/${targetUnitId}`;
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Booking
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form step
  // Pre-qualification step
  if (step === "prequalify" || step === "prequalify-failed") {
    const isFailed = step === "prequalify-failed";
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isFailed ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-primary" />
              )}
              <h1 className="text-lg font-semibold">
                {isFailed ? "Pre-Qualification Not Passed" : "Pre-Qualification Required"}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("units")}
              data-testid="button-back-to-units"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-auto">
            <CardHeader>
              <CardTitle>
                {isFailed ? "Unfortunately, you did not qualify" : "Please answer the following questions"}
              </CardTitle>
              <CardDescription>
                {isFailed 
                  ? qualificationMessage || "Based on your responses, this property may not be the right fit at this time."
                  : qualificationReqs?.introMessage || "Please complete this pre-qualification to proceed with booking."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isFailed ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    If you believe this is an error, please contact the property manager directly.
                  </p>
                  {qualificationReqs?.allowRetry && (
                    <Button 
                      onClick={() => {
                        setQualificationAnswers({});
                        setStep("prequalify");
                      }}
                      variant="outline"
                      data-testid="button-retry-qualification"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleQualificationSubmit} className="space-y-6">
                  {/* Lead info section */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="font-medium text-sm">Your Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="qual-name">Name *</Label>
                        <Input
                          id="qual-name"
                          placeholder="Your full name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          data-testid="input-qual-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="qual-email">Email *</Label>
                        <Input
                          id="qual-email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          data-testid="input-qual-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qual-phone">Phone (optional)</Label>
                      <Input
                        id="qual-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        data-testid="input-qual-phone"
                      />
                    </div>
                  </div>

                  {/* Questions section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm">Pre-Qualification Questions</h3>
                    {qualificationReqs?.questions && qualificationReqs.questions.length > 0 ? (
                      qualificationReqs.questions.map((question, idx) => (
                      <div key={question.id} className="space-y-2">
                        <Label>
                          {question.question} {question.required && <span className="text-destructive">*</span>}
                        </Label>
                        
                        {question.type === "text" && (
                          <Input
                            placeholder="Your answer"
                            value={qualificationAnswers[question.id] || ""}
                            onChange={(e) => setQualificationAnswers({
                              ...qualificationAnswers,
                              [question.id]: e.target.value,
                            })}
                            required={question.required}
                            data-testid={`input-qual-question-${idx}`}
                          />
                        )}
                        
                        {question.type === "number" && (
                          <Input
                            type="number"
                            placeholder="Enter a number"
                            value={qualificationAnswers[question.id] || ""}
                            onChange={(e) => setQualificationAnswers({
                              ...qualificationAnswers,
                              [question.id]: e.target.value ? Number(e.target.value) : undefined,
                            })}
                            required={question.required}
                            data-testid={`input-qual-question-${idx}`}
                          />
                        )}
                        
                        {question.type === "boolean" && (
                          <RadioGroup
                            value={qualificationAnswers[question.id]?.toString() || ""}
                            onValueChange={(val) => setQualificationAnswers({
                              ...qualificationAnswers,
                              [question.id]: val === "true",
                            })}
                            className="flex gap-4"
                            data-testid={`radio-qual-question-${idx}`}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="true" id={`${question.id}-yes`} />
                              <Label htmlFor={`${question.id}-yes`}>Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="false" id={`${question.id}-no`} />
                              <Label htmlFor={`${question.id}-no`}>No</Label>
                            </div>
                          </RadioGroup>
                        )}
                        
                        {question.type === "select" && question.options && (
                          <Select
                            value={qualificationAnswers[question.id] || ""}
                            onValueChange={(val) => setQualificationAnswers({
                              ...qualificationAnswers,
                              [question.id]: val,
                            })}
                          >
                            <SelectTrigger data-testid={`select-qual-question-${idx}`}>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No questions available at this time.</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={qualifyMutation.isPending}
                    data-testid="button-submit-qualification"
                  >
                    {qualifyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Pre-Qualification"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </div>
        </Card>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{isRescheduling ? "Reschedule Your Showing" : "Book Your Showing"}</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("select")}
              data-testid="button-back-to-calendar"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-auto">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>
                Please provide your contact details to confirm your showing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Unit Details with Cover Photo */}
                {displayUnit && (
                  <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg border">
                    {/* Unit Cover Photo */}
                    <div className="flex-shrink-0">
                      {(() => {
                        // Use unit cover photo, fallback to property cover photo (same as header section)
                        const coverPhoto = displayUnit.coverPhoto || property.coverPhoto;
                        return coverPhoto ? (
                          <img
                            src={coverPhoto}
                            alt={`Unit ${displayUnit.unitNumber}`}
                            className="w-24 h-24 object-cover rounded-lg border shadow-sm"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
                            <Home className="h-10 w-10 text-muted-foreground" />
                          </div>
                        );
                      })()}
                    </div>
                    {/* Unit Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">
                        Unit {displayUnit.unitNumber}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>{displayUnit.bedrooms} {displayUnit.bedrooms === 1 ? 'bed' : 'beds'}</span>
                        <span>•</span>
                        <span>{displayUnit.bathrooms} {displayUnit.bathrooms === '1' ? 'bath' : 'baths'}</span>
                        {displayUnit.squareFeet && (
                          <>
                            <span>•</span>
                            <span>{displayUnit.squareFeet.toLocaleString()} sq ft</span>
                          </>
                        )}
                        {displayUnit.monthlyRent && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-primary">${parseFloat(displayUnit.monthlyRent).toLocaleString()}/mo</span>
                          </>
                        )}
                      </div>
                      {displayUnit.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {displayUnit.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Selected time display */}
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{selectedSlot?.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{selectedSlot?.time ? formatTimeTo12Hour(selectedSlot.time) : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{property.address}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      data-testid="input-name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      data-testid="input-phone"
                      placeholder="555-123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={bookMutation.isPending}
                  data-testid="button-book-showing"
                >
                  {bookMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isRescheduling ? "Rescheduling..." : "Booking..."}
                    </>
                  ) : (
                    isRescheduling ? "Confirm Reschedule" : "Confirm Booking"
                  )}
                </Button>
              </form>
            </CardContent>
          </div>
        </Card>
      </div>
    );
  }

  // Get organization initials for avatar fallback
  const orgInitials = organization?.name
    ? organization.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase()
    : 'PM';

  // Step 1: Date/Time Selection with new 3-column layout
  return (
    <TooltipProvider>
      <div className="h-screen bg-muted/30 flex items-center justify-center p-6">
        {/* Floating Card Container */}
        <Card className="h-full w-full max-w-7xl flex overflow-hidden shadow-lg">
          {/* Left Panel - Event Details */}
          <div className="w-80 border-r bg-card flex flex-col p-6 overflow-auto">
          {/* View Other Units button for regular unit bookings (NOT shown when rescheduling) */}
          {(() => {
            // Use window.location to check if URL contains "reschedule" (wouter's location doesn't include query string)
            const fullUrl = window.location.href.toLowerCase();
            const urlContainsReschedule = fullUrl.includes('reschedule');
            const showButton = isUnitBooking && effectivePropertyId && !rescheduleShowingId && !isRescheduling && !urlContainsReschedule;
            if (isUnitBooking) {
              console.log('[PublicBooking] View Other Units button render check:', {
                isUnitBooking,
                effectivePropertyId,
                rescheduleShowingId,
                isRescheduling,
                urlContainsReschedule,
                fullUrl,
                showButton
              });
            }
            return showButton;
          })() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Navigate to property-level booking view to see all units
                const url = `/book-showing/property/${effectivePropertyId}`;
                window.location.href = url;
              }}
              className="mb-4 self-start"
              data-testid="button-view-other-units-header"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              View Other Units
            </Button>
          )}
          
          {/* Organization Header */}
          <div className="flex items-center gap-3 mb-6">
            {organization?.logo || organization?.profileImage ? (
              <img
                src={organization.logo || organization.profileImage || ''}
                alt={organization?.name || "Property Management"}
                className="h-12 w-12 rounded-lg object-cover border flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg flex-shrink-0">
                {orgInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-base truncate">{organization?.name || "Property Management"}</h2>
              <p className="text-xs text-muted-foreground">Property Showing</p>
              {organization && (organization.email || organization.phone || (!isUnitBooking && organization.address)) && (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {organization.email && (
                    <div className="flex items-center gap-1">
                      <span>Email: {organization.email}</span>
                    </div>
                  )}
                  {organization.phone && (
                    <div className="flex items-center gap-1">
                      <span>Phone: {organization.phone}</span>
                    </div>
                  )}
                  {!isUnitBooking && organization.address && (
                    <div className="flex items-center gap-1">
                      <span>Address: {organization.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Property Details */}
          <div className="space-y-4 flex-1">
            {/* Back button for property-level bookings */}
            {!isUnitBooking && selectedUnitId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("units");
                  setSelectedUnitId(null);
                  setSelectedDate(undefined);
                  setSelectedSlot(null);
                }}
                className="mb-2"
                data-testid="button-back-to-units"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Change Unit
              </Button>
            )}
            
            {/* Event Name - Above cover photo and property name */}
            {eventName && (
              <h2 className="text-xl font-bold mb-4" data-testid="text-event-name">{eventName}</h2>
            )}

            {/* Unit Cover Photo and Details */}
            {displayUnit && (() => {
              // Use unit cover photo, fallback to property cover photo
              const coverPhoto = displayUnit.coverPhoto || property.coverPhoto;
              return (
                <div className="flex items-start gap-4 mb-4">
                  {/* Unit Cover Photo */}
                  <div className="flex-shrink-0">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={`Unit ${displayUnit.unitNumber}`}
                        className="w-24 h-24 object-cover rounded-lg border shadow-sm"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
                        <Home className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {/* Unit Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1" data-testid="text-property-name">{property.name}</h3>
                    <p className="text-sm text-muted-foreground" data-testid="text-unit-number">
                      Unit {displayUnit.unitNumber}
                    </p>
                    {displayUnit.monthlyRent && (
                      <p className="text-sm font-semibold text-primary mt-1" data-testid="text-unit-rent">
                        ${parseFloat(displayUnit.monthlyRent).toLocaleString()}/mo
                      </p>
                    )}
                    {displayUnit.squareFeet && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-unit-square-feet">
                        {displayUnit.squareFeet.toLocaleString()} sq ft
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {!displayUnit && (
              <div className="flex items-start gap-4 mb-4">
                {/* Property Cover Photo */}
                <div className="flex-shrink-0">
                  {property.coverPhoto ? (
                    <img
                      src={property.coverPhoto}
                      alt={property.name}
                      className="w-24 h-24 object-cover rounded-lg border shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
                      <Home className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1" data-testid="text-property-name">{property.name}</h3>
                </div>
              </div>
            )}

            {/* Property Address */}
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground" data-testid="text-address">{fullAddress}</span>
            </div>

            {/* Event Duration - Right below address, same style */}
            <div className="flex items-start gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground" data-testid="text-duration">
                {eventDuration} min
              </span>
            </div>

            {/* Horizontal Event Details */}
            <div className="flex flex-wrap gap-3">
              {displayUnit && (
                <>
                  <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
                    <BedDouble className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-bedrooms">
                      {displayUnit.bedrooms} {displayUnit.bedrooms === 1 ? 'bed' : 'beds'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-md">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-bathrooms">
                      {displayUnit.bathrooms} {displayUnit.bathrooms === '1' ? 'bath' : 'baths'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {eventDescription && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-event-description">
                  {eventDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Calendar and Time Slots */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Calendar Section - Always centered */}
          <div className="flex flex-col p-8 justify-center items-center w-1/2 border-r overflow-auto">
            <div className="flex-shrink-0 mb-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Select a Date</h2>
              <p className="text-sm text-muted-foreground">Choose from available dates below</p>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                disabled={(date) => {
                  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                  const hasSlots = availableDates.some(availDate => 
                    availDate.getFullYear() === date.getFullYear() &&
                    availDate.getMonth() === date.getMonth() &&
                    availDate.getDate() === date.getDate()
                  );
                  return isPast || !hasSlots;
                }}
                modifiers={{
                  available: availableDates,
                }}
                modifiersClassNames={{
                  available: "rdp-day-available",
                  selected: "rdp-day-selected",
                }}
                components={{
                  Caption: CustomCaption,
                }}
                fromDate={new Date()}
                toDate={addMonths(new Date(), 3)}
                showOutsideDays={false}
                className="rdp-custom"
                data-testid="calendar-datepicker"
              />
              {property.timezone && (
                <p className="text-xs text-muted-foreground mt-4" data-testid="text-timezone">
                  All times shown in {property.timezone.replace(/[_/]/g, ' ')}
                </p>
              )}
            </div>
          </div>

          {/* Time Slots Section */}
          <div 
            className={`
              flex flex-col p-8 overflow-y-auto overflow-x-hidden w-1/2
              ${selectedDate 
                ? 'opacity-100' 
                : 'opacity-0 pointer-events-none'
              }
            `}
          >
            <div className="flex-shrink-0 mb-4">
              <h2 className="text-lg font-semibold mb-1">
                {selectedDate ? `Available Times for ${format(selectedDate, 'MMM d, yyyy')}` : 'Select a Date'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedDate ? 'Choose your preferred time slot' : 'Pick a date to see available times'}
              </p>
            </div>

            {selectedDate && selectedDateSlots.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center">
                <div className="text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No available times for this date</p>
                </div>
              </div>
            )}

            {selectedDate && selectedDateSlots.length > 0 && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center">
                <div className="w-full max-w-md space-y-3 pb-4">
                  {selectedDateSlots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      onClick={() => setSelectedSlot(slot)}
                      data-testid={`button-timeslot-${slot.time}`}
                      className={`
                        w-full p-4 rounded-lg border-2 hover-elevate active-elevate-2
                        ${selectedSlot?.time === slot.time && selectedSlot?.date === slot.date
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                        }
                      `}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-xl">{formatTimeTo12Hour(slot.time)}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedSlot && (
                  <div className="w-full max-w-md sticky bottom-0 bg-background pt-4 border-t mt-4">
                    <Button
                      onClick={handleContinueToForm}
                      className="w-full"
                      size="lg"
                      data-testid="button-continue-to-form"
                    >
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}

// Wrap the entire page in ThemeProvider forcing light mode for consistent branding
export default function PublicBooking() {
  return (
    <ThemeProvider forcedTheme="light">
      <PublicBookingContent />
    </ThemeProvider>
  );
}
