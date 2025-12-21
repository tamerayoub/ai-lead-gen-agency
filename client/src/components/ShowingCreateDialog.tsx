import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertShowingSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Property, Lead } from "@shared/schema";

interface ShowingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPropertyId?: string;
  preselectedLeadId?: string;
}

// Client-side schema - omit orgId (injected server-side for security)
const formSchema = insertShowingSchema.omit({ orgId: true }).extend({
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTime: z.string().min(1, "Time is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ShowingCreateDialog({ 
  open, 
  onOpenChange,
  preselectedPropertyId,
  preselectedLeadId 
}: ShowingCreateDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);

  // Fetch properties
  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch leads
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyId: preselectedPropertyId || "",
      leadId: preselectedLeadId || "",
      title: "",
      scheduledDate: "",
      scheduledTime: "",
      durationMinutes: 30,
      showingType: "in_person",
      description: "",
      location: "",
      accessMethod: "",
      lockboxCode: "",
      specialInstructions: "",
      status: "pending",
    },
  });

  // Watch property and date selections for AI suggestions
  const selectedPropertyId = form.watch("propertyId");
  const selectedDate = form.watch("scheduledDate");

  // Fetch AI time slot suggestions when property and date are selected
  const { data: timeSuggestions, isLoading: suggestionsLoading } = useQuery<{
    suggestions: Array<{
      time: string;
      score: number;
      reason: string;
      conflicts: Array<{ type: string; message: string; }>;
    }>;
  }>({
    queryKey: ['showing-time-suggestions', selectedPropertyId, selectedDate],
    enabled: !!selectedPropertyId && !!selectedDate && step === 2,
    queryFn: async ({ queryKey }) => {
      const [, propertyId, date] = queryKey;
      const response = await apiRequest('POST', '/api/showings/suggest-times', {
        propertyId,
        date,
      });
      return response.json();
    },
  });

  // Watch all fields needed for conflict detection
  const selectedTime = form.watch("scheduledTime");
  const selectedDuration = form.watch("durationMinutes");

  // Ensure duration is a valid number
  const validDuration = typeof selectedDuration === 'number' && !isNaN(selectedDuration) 
    ? selectedDuration 
    : 30;

  // Analyze conflicts when all required fields are filled
  const { data: conflictsData } = useQuery<{
    conflicts: Array<{
      type: 'overlap' | 'travel_time' | 'outside_hours' | 'double_booking';
      severity: 'warning' | 'error';
      message: string;
      relatedShowingId?: string;
    }>;
  }>({
    queryKey: ['showing-conflicts', selectedPropertyId, selectedDate, selectedTime, validDuration],
    enabled: !!selectedPropertyId && !!selectedDate && !!selectedTime && 
             typeof validDuration === 'number' && !isNaN(validDuration) && step === 2,
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/showings/analyze-conflicts', {
        propertyId: selectedPropertyId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        durationMinutes: validDuration,
      });
      return response.json();
    },
  });

  // Create showing mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/showings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Showing scheduled",
        description: "The property showing has been successfully scheduled",
      });
      // Invalidate all showing queries (both direct and range queries)
      queryClient.invalidateQueries({ queryKey: ["/api/showings"], exact: false });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/showings/range?")
      });
      form.reset();
      setStep(1);
      setSelectedCalendarDate(undefined);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule showing",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Reset form when dialog opens or preselected values change
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedCalendarDate(undefined);
      form.reset({
        propertyId: preselectedPropertyId || "",
        leadId: preselectedLeadId || "",
        title: "",
        scheduledDate: "",
        scheduledTime: "",
        durationMinutes: 30,
        showingType: "in_person",
        description: "",
        location: "",
        accessMethod: "",
        lockboxCode: "",
        specialInstructions: "",
        status: "pending",
      });
    }
  }, [open, preselectedPropertyId, preselectedLeadId, form]);

  const handleNext = () => {
    if (step === 1) {
      const propertyId = form.getValues("propertyId");
      if (!propertyId) {
        toast({
          title: "Property required",
          description: "Please select a property",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const scheduledDate = form.getValues("scheduledDate");
      const scheduledTime = form.getValues("scheduledTime");
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: "Date and time required",
          description: "Please select both date and time",
          variant: "destructive",
        });
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = (values: FormValues) => {
    // Transform empty strings to null for optional fields
    const cleanedValues = {
      ...values,
      leadId: values.leadId || null,
      accessMethod: values.accessMethod || null,
      lockboxCode: values.lockboxCode || null,
      description: values.description || null,
      location: values.location || null,
      specialInstructions: values.specialInstructions || null,
    };
    console.log("Submitting showing:", cleanedValues);
    createMutation.mutate(cleanedValues as any);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedCalendarDate(date);
      form.setValue("scheduledDate", format(date, "yyyy-MM-dd"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-create-showing">
        <DialogHeader>
          <DialogTitle>Schedule Property Showing - Step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Select the property and lead for this showing"}
            {step === 2 && "Choose the date and time for the showing"}
            {step === 3 && "Add showing details and access information"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            {/* Step 1: Property & Lead Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!!preselectedPropertyId}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-property">
                            <SelectValue placeholder="Select a property" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {properties?.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="leadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead (Optional)</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!!preselectedLeadId}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-lead">
                            <SelectValue placeholder="Select a lead (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leads?.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.name} ({lead.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Showing Title *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Property Tour with John Smith"
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Date & Time Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <div>
                          <Calendar
                            mode="single"
                            selected={selectedCalendarDate}
                            onSelect={handleCalendarSelect}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            className="rounded-md border"
                            data-testid="calendar-date-picker"
                          />
                          {field.value && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Selected: {format(new Date(field.value), "MMMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* AI Time Slot Suggestions */}
                {selectedDate && selectedPropertyId && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">AI-Suggested Time Slots</h3>
                    </div>

                    {suggestionsLoading ? (
                      <Card className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" data-testid="loader-time-suggestions" />
                          <span>Analyzing your schedule...</span>
                        </div>
                      </Card>
                    ) : timeSuggestions && timeSuggestions.suggestions && timeSuggestions.suggestions.length > 0 ? (
                      <div className="grid gap-2" data-testid="list-time-suggestions">
                        {timeSuggestions.suggestions.map((suggestion, index) => (
                          <Card 
                            key={index}
                            className="p-3 cursor-pointer hover-elevate active-elevate-2 transition-colors"
                            onClick={() => form.setValue("scheduledTime", suggestion.time)}
                            data-testid={`card-time-suggestion-${index}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{suggestion.time}</span>
                                  <Badge variant={suggestion.score >= 80 ? "default" : "secondary"} data-testid={`badge-score-${index}`}>
                                    {suggestion.score}% optimal
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                                {suggestion.conflicts && suggestion.conflicts.length > 0 && (
                                  <div className="flex items-start gap-1 text-sm text-destructive" data-testid={`conflict-warning-${index}`}>
                                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                                    <span>{suggestion.conflicts[0].message}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground" data-testid="text-no-suggestions">
                          No AI suggestions available. Select a time manually below.
                        </p>
                      </Card>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="time" 
                            data-testid="input-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="durationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number"
                            min={15}
                            max={480}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-duration"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="showingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Showing Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-showing-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in_person">In Person</SelectItem>
                          <SelectItem value="virtual">Virtual Tour</SelectItem>
                          <SelectItem value="open_house">Open House</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Conflict Warnings */}
                {conflictsData && conflictsData.conflicts && conflictsData.conflicts.length > 0 && (
                  <div className="space-y-2" data-testid="section-conflict-warnings">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Scheduling Conflicts Detected
                    </h3>
                    <div className="space-y-2">
                      {conflictsData.conflicts.map((conflict, index) => (
                        <Card 
                          key={index}
                          className={`p-3 border-l-4 ${
                            conflict.severity === 'error' 
                              ? 'border-l-destructive bg-destructive/5' 
                              : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                          }`}
                          data-testid={`card-conflict-${index}`}
                        >
                          <div className="flex items-start gap-2">
                            {conflict.severity === 'error' ? (
                              <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 space-y-1">
                              <p className={`text-sm font-medium ${
                                conflict.severity === 'error' 
                                  ? 'text-destructive' 
                                  : 'text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {conflict.type === 'overlap' && 'Time Overlap'}
                                {conflict.type === 'travel_time' && 'Insufficient Travel Time'}
                                {conflict.type === 'outside_hours' && 'Outside Preferred Hours'}
                                {conflict.type === 'double_booking' && 'Double Booking'}
                              </p>
                              <p className="text-sm text-muted-foreground">{conflict.message}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    {conflictsData.conflicts.some(c => c.severity === 'error') && (
                      <p className="text-sm text-muted-foreground italic">
                        You can proceed anyway, but conflicts should be resolved for optimal scheduling.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Details & Access */}
            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Add any notes about this showing"
                          rows={3}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Location</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          placeholder="e.g., Meet at front door"
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Method (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-access-method">
                            <SelectValue placeholder="Select access method (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lockbox">Lockbox</SelectItem>
                          <SelectItem value="key_pickup">Key Pickup</SelectItem>
                          <SelectItem value="agent_present">Agent Present</SelectItem>
                          <SelectItem value="tenant_occupied">Tenant Occupied</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("accessMethod") === "lockbox" && (
                  <FormField
                    control={form.control}
                    name="lockboxCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lockbox Code</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="Enter lockbox code"
                            data-testid="input-lockbox-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="specialInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="e.g., Call tenant 30 minutes before arrival"
                          rows={3}
                          data-testid="textarea-special-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    console.log("Schedule button clicked");
                    console.log("Form errors:", form.formState.errors);
                    console.log("Form values:", form.getValues());
                    form.handleSubmit(handleSubmit)();
                  }}
                  disabled={createMutation.isPending}
                  data-testid="button-create-showing"
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Check className="h-4 w-4 mr-2" />
                  Schedule Showing
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
