import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Property, Lead, Showing } from "@shared/schema";

interface ShowingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showing: Showing | null;
  mode?: "edit" | "reschedule"; // Add mode to distinguish edit vs reschedule
}

// Base schema - will be extended based on mode
const baseFormSchema = insertShowingSchema.omit({ orgId: true });

type FormValues = z.infer<typeof baseFormSchema> & {
  scheduledDate?: string;
  scheduledTime?: string;
  unitId?: string | null;
};

type ActiveSection = "details" | "questions" | "notes" | "timeline";

export default function ShowingEditDialog({ 
  open, 
  onOpenChange,
  showing,
  mode = "edit"
}: ShowingEditDialogProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<ActiveSection>("details");
  
  // Create schema based on mode - date/time required only for reschedule
  const formSchemaWithMode = mode === "reschedule"
    ? insertShowingSchema.omit({ orgId: true }).extend({
        scheduledDate: z.string().min(1, "Date is required"),
        scheduledTime: z.string().min(1, "Time is required"),
        unitId: z.string().nullable().optional(),
      })
    : insertShowingSchema.omit({ orgId: true }).extend({
        scheduledDate: z.string().optional(),
        scheduledTime: z.string().optional(),
        unitId: z.string().nullable().optional(),
      });

  // Fetch properties
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch leads
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch organization members for assignment
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>>({
    queryKey: ["/api/org/members"],
  });

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchemaWithMode),
    defaultValues: {
      propertyId: "",
      leadId: null,
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
      assignedTo: null,
      feedbackNotes: "",
      unitId: null,
    },
  });

  // Update form when showing changes
  useEffect(() => {
    if (showing && open) {
      form.reset({
        propertyId: showing.propertyId,
        leadId: showing.leadId ?? null,
        title: showing.title,
        scheduledDate: showing.scheduledDate,
        scheduledTime: showing.scheduledTime,
        durationMinutes: showing.durationMinutes,
        showingType: showing.showingType,
        description: showing.description || "",
        location: showing.location || "",
        accessMethod: showing.accessMethod || "",
        lockboxCode: showing.lockboxCode || "",
        specialInstructions: showing.specialInstructions || "",
        status: showing.status,
        assignedTo: showing.assignedTo ?? null,
        feedbackNotes: showing.feedbackNotes || "",
        unitId: (showing as any).unitId ?? null,
      });
    }
  }, [showing, open, form]);

  // Watch propertyId to fetch units when property changes
  const selectedPropertyId = form.watch("propertyId");
  
  // Fetch units for the selected property
  const { data: propertyUnits = [] } = useQuery<Array<{
    id: string;
    unitNumber: string;
    bedrooms: number;
    bathrooms: string;
  }>>({
    queryKey: ["/api/properties", selectedPropertyId, "units"],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const response = await apiRequest("GET", `/api/properties/${selectedPropertyId}/units`);
      return response.json();
    },
    enabled: !!selectedPropertyId,
  });

  // Watch form values for time slot fetching
  const selectedDate = form.watch("scheduledDate");
  const selectedAgent = form.watch("assignedTo");
  const selectedUnitId = form.watch("unitId");

  // Fetch available time slots based on property, date, and agent
  const { data: availableTimeSlots = { availableSlots: [] }, isLoading: loadingSlots } = useQuery<{ availableSlots: string[] }>({
    queryKey: ["/api/showings/available-times", selectedPropertyId, selectedDate, selectedAgent, selectedUnitId, showing?.id],
    queryFn: async () => {
      if (!selectedPropertyId || !selectedDate) return { availableSlots: [] };
      const params = new URLSearchParams({
        propertyId: selectedPropertyId,
        date: selectedDate,
      });
      if (selectedAgent) params.append("assignedTo", selectedAgent);
      if (selectedUnitId) params.append("unitId", selectedUnitId);
      if (showing?.id) params.append("excludeShowingId", showing.id);
      const response = await apiRequest("GET", `/api/showings/available-times?${params.toString()}`);
      return response.json();
    },
    enabled: !!selectedPropertyId && !!selectedDate,
  });

  // Update showing mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!showing) throw new Error("No showing to update");
      const res = await apiRequest("PATCH", `/api/showings/${showing.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Showing updated",
        description: "The showing has been successfully updated",
      });
      // Invalidate all showing queries
      queryClient.invalidateQueries({ queryKey: ["/api/showings"], exact: false });
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/showings/range?")
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to update showing",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    // If rescheduling a cancelled event, change status to "requested"
    if (mode === "reschedule" && showing?.status === "cancelled") {
      data.status = "requested";
    }
    updateMutation.mutate(data);
  };

  if (!showing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-showing">
        <DialogHeader>
          <DialogTitle>{mode === "reschedule" ? "Reschedule Showing" : "Edit Showing"}</DialogTitle>
          <DialogDescription>
            {mode === "reschedule" ? "Change the date and time of this showing" : "Update the details of this showing"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Assigned To - Move before date/time to enable time slot selection */}
            <div className="space-y-4 pb-4 border-b">
              <h3 className="text-sm font-semibold text-muted-foreground">Agent</h3>
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <div className="flex gap-2">
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-assigned-to" className="flex-1">
                            <SelectValue placeholder="Select an agent to see available times" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orgMembers.map((member) => {
                            const displayName = member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.email;
                            return (
                              <SelectItem key={member.id} value={member.id} data-testid={`select-member-${member.id}`}>
                                {displayName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange(null)}
                          data-testid="button-clear-assignee"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date and Time Section - Only show for reschedule mode */}
            {mode === "reschedule" && (
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground">Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time *</FormLabel>
                        {selectedDate && selectedPropertyId ? (
                          <div className="space-y-2">
                            {loadingSlots ? (
                              <div className="text-sm text-muted-foreground">Loading available times...</div>
                            ) : availableTimeSlots.availableSlots && availableTimeSlots.availableSlots.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                {availableTimeSlots.availableSlots.map((time: string) => (
                                  <Button
                                    key={time}
                                    type="button"
                                    variant={field.value === time ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => field.onChange(time)}
                                    className="text-xs"
                                    data-testid={`button-timeslot-${time.replace(':', '')}`}
                                  >
                                    {format(new Date(`2000-01-01T${time}`), "h:mm a")}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {selectedAgent ? "No available times for this agent on this date. Try another date or agent." : "Select an agent to see available times."}
                              </div>
                            )}
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="input-time"
                                placeholder="Or enter custom time"
                              />
                            </FormControl>
                          </div>
                        ) : (
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-time" />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Floating Navigation Bar - Only Details and Questions for Edit/Reschedule */}
            <div className="sticky top-0 z-10 bg-background border-b rounded-t-lg -mx-6 px-6 py-2 mb-4">
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
              </div>
            </div>

            {/* Section Content */}
            <div className="min-h-[400px]">
              {activeSection === "details" && (
                <div className="space-y-4">
                  {/* Lead Selection - First Field */}
                  <FormField
                    control={form.control}
                    name="leadId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead</FormLabel>
                        <div className="flex gap-2">
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-lead" className="flex-1">
                                <SelectValue placeholder="Select a lead (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {leads.map((lead) => (
                                <SelectItem key={lead.id} value={lead.id} data-testid={`select-lead-${lead.id}`}>
                                  {lead.name || lead.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => field.onChange(null)}
                              data-testid="button-clear-lead"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Property Selection */}
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property *</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Reset unitId when property changes
                          form.setValue("unitId", null);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-property">
                              <SelectValue placeholder="Select a property" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id} data-testid={`select-property-${property.id}`}>
                                {property.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Unit Selection (conditional on property) */}
                  {selectedPropertyId && propertyUnits.length > 0 && (
                    <FormField
                      control={form.control}
                      name="unitId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <div className="flex gap-2">
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger data-testid="select-unit" className="flex-1">
                                  <SelectValue placeholder="Select a unit (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {propertyUnits.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.id} data-testid={`select-unit-${unit.id}`}>
                                    Unit {unit.unitNumber} ({unit.bedrooms} bed, {unit.bathrooms} bath)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.value && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => field.onChange(null)}
                                data-testid="button-clear-unit"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Property showing" {...field} data-testid="input-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Duration and Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-duration"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="showingType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-showing-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="in_person">In Person</SelectItem>
                              <SelectItem value="virtual">Virtual</SelectItem>
                              <SelectItem value="self_guided">Self Guided</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes about this showing"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  {/* Special Instructions */}
                  <FormField
                    control={form.control}
                    name="specialInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special instructions for the showing"
                            {...field}
                            data-testid="input-special-instructions"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>
              )}

              {activeSection === "questions" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Questions section - Coming soon</p>
                </div>
              )}

              {activeSection === "notes" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="feedbackNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add notes about this showing..."
                            {...field}
                            rows={10}
                            className="resize-none"
                            data-testid="textarea-edit-showing-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                              {showing.createdAt ? format(new Date(showing.createdAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This showing was created
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Event Updated (if different from created) */}
                    {showing && showing.updatedAt && showing.updatedAt !== showing.createdAt && (
                      <div className="flex gap-3 pb-3 border-b">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Event Updated</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(showing.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This showing was last modified
                          </p>
                        </div>
                      </div>
                    )}

                    {(!showing || (showing.updatedAt === showing.createdAt)) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No additional activity recorded
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Access Method */}
            <FormField
              control={form.control}
              name="accessMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Method</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-access-method" className="flex-1">
                          <SelectValue placeholder="Select access method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lockbox">Lockbox</SelectItem>
                        <SelectItem value="key_with_agent">Key with Agent</SelectItem>
                        <SelectItem value="tenant_occupied">Tenant Occupied</SelectItem>
                        <SelectItem value="vacant_unlocked">Vacant/Unlocked</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => field.onChange(null)}
                        data-testid="button-clear-access-method"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lockbox Code (conditional) */}
            {form.watch("accessMethod") === "lockbox" && (
              <FormField
                control={form.control}
                name="lockboxCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lockbox Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter lockbox code"
                        {...field}
                        data-testid="input-lockbox-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Special Instructions */}
            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any special instructions for the showing"
                      {...field}
                      data-testid="input-special-instructions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "reschedule" ? "Reschedule" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
