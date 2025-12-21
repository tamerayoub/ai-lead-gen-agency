import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPropertySchema } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PropertyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    id: string;
    name: string;
    address: string;
    units: number;
    occupancy: number;
    monthlyRevenue: string;
    description?: string;
    amenities?: string[];
  } | null;
}

// Shared form schema for property forms
const formSchema = insertPropertySchema.extend({
  units: z.coerce.number().int().min(1, "Must have at least 1 unit").default(1),
  occupancy: z.coerce.number().int().min(0, "Cannot be negative").default(0),
  monthlyRevenue: z.string().default("0"),
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
}).refine((data) => data.occupancy <= data.units, {
  message: "Occupancy cannot exceed total units",
  path: ["occupancy"],
});

type FormValues = z.infer<typeof formSchema>;

export default function PropertyEditDialog({ open, onOpenChange, property }: PropertyEditDialogProps) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      units: 1,
      occupancy: 0,
      monthlyRevenue: "0",
      description: "",
      amenities: [],
    },
  });

  // Update form values when property ID changes or dialog opens/closes
  useEffect(() => {
    if (open && property) {
      // Reset form immediately when property changes (even if dialog already open)
      form.reset({
        name: property.name,
        address: property.address,
        units: property.units,
        occupancy: property.occupancy,
        monthlyRevenue: property.monthlyRevenue,
        description: property.description || "",
        amenities: property.amenities || [],
      });
    } else if (!open) {
      // Clear form when dialog closes
      form.reset({
        name: "",
        address: "",
        units: 1,
        occupancy: 0,
        monthlyRevenue: "0",
        description: "",
        amenities: [],
      });
    }
  }, [open, property?.id, property, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!property?.id) throw new Error("No property ID");
      const res = await apiRequest("PATCH", `/api/properties/${property.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Property updated",
        description: "The property has been successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update property",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-edit-property">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
          <DialogDescription>
            Update property details for {property?.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., Sunset Apartments"
                      data-testid="input-edit-property-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., 123 Main St, Minneapolis, MN 55401"
                      data-testid="input-edit-property-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Units *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        min={1}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-edit-property-units"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occupancy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupied Units</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        min={0}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-edit-property-occupancy"
                      />
                    </FormControl>
                    <FormDescription>Currently occupied units</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="monthlyRevenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Revenue</FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      placeholder="e.g., $15,000"
                      data-testid="input-edit-property-revenue"
                    />
                  </FormControl>
                  <FormDescription>Optional: Total monthly rental income</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter a detailed description of the property..."
                      rows={4}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormDescription>Optional: Marketing description of the property</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amenities"
              render={({ field }) => {
                const [newAmenity, setNewAmenity] = useState("");
                const amenities = field.value || [];

                const handleAddAmenity = () => {
                  if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
                    field.onChange([...amenities, newAmenity.trim()]);
                    setNewAmenity("");
                  }
                };

                const handleRemoveAmenity = (amenity: string) => {
                  field.onChange(amenities.filter((a: string) => a !== amenity));
                };

                return (
                  <FormItem>
                    <FormLabel>Amenities</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., washer/dryer, parking, balcony"
                            value={newAmenity}
                            onChange={(e) => setNewAmenity(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddAmenity();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddAmenity}
                            disabled={!newAmenity.trim() || amenities.includes(newAmenity.trim())}
                          >
                            Add
                          </Button>
                        </div>
                        {amenities.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {amenities.map((amenity: string, index: number) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                              >
                                <span>{amenity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAmenity(amenity)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>Optional: List of property amenities</FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-property"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-update-property"
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Property
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
