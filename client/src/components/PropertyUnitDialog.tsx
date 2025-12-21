import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, MoreVertical, Image as ImageIcon } from "lucide-react";
import { insertPropertyUnitSchema, PropertyUnit } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { FormLabel } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";

// Create form schema with proper validation messages
const formSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required"),
  bedrooms: z.number().min(0, "Bedrooms must be 0 or greater"),
  bathrooms: z.string().min(1, "Bathrooms is required"),
  squareFeet: z.number().optional(),
  monthlyRent: z.string().optional(),
  deposit: z.string().optional(),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  status: z.string(),
  isListed: z.boolean(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  customEventDescription: z.string().optional(),
  notes: z.string().optional(),
  coverPhoto: z.string().optional(),
  photos: z.array(z.string()).default([]),
});

interface PropertyUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unit: PropertyUnit | null;
}

export default function PropertyUnitDialog({
  open,
  onOpenChange,
  propertyId,
  unit,
}: PropertyUnitDialogProps) {
  const { toast } = useToast();
  const isEditing = !!unit;
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitNumber: unit?.unitNumber || "",
      bedrooms: unit?.bedrooms || 0,
      bathrooms: unit?.bathrooms || "",
      squareFeet: unit?.squareFeet || undefined,
      monthlyRent: unit?.monthlyRent || "",
      deposit: unit?.deposit || "",
      status: unit?.status || "not_occupied",
      isListed: unit?.isListed || false,
      description: unit?.description || "",
      amenities: unit?.amenities || [],
      customEventDescription: unit?.customEventDescription || "",
      notes: unit?.notes || "",
      leaseStartDate: unit?.leaseStartDate || "",
      leaseEndDate: unit?.leaseEndDate || "",
      coverPhoto: unit?.coverPhoto || "",
      photos: unit?.photos || [],
    },
  });

  // Update form when unit changes
  useEffect(() => {
    if (unit) {
      form.reset({
        unitNumber: unit.unitNumber || "",
        bedrooms: unit.bedrooms || 0,
        bathrooms: unit.bathrooms || "",
        squareFeet: unit.squareFeet || undefined,
        monthlyRent: unit.monthlyRent || "",
        deposit: unit.deposit || "",
        status: unit.status || "not_occupied",
        isListed: unit.isListed || false,
        description: unit.description || "",
        amenities: unit.amenities || [],
        customEventDescription: unit.customEventDescription || "",
        notes: unit.notes || "",
        leaseStartDate: unit.leaseStartDate || "",
        leaseEndDate: unit.leaseEndDate || "",
        coverPhoto: unit.coverPhoto || "",
        photos: unit.photos || [],
      });
    } else {
      form.reset({
        unitNumber: "",
        bedrooms: 0,
        bathrooms: "",
        squareFeet: undefined,
        monthlyRent: "",
        deposit: "",
        status: "not_occupied",
        isListed: false,
        description: "",
        amenities: [],
        customEventDescription: "",
        notes: "",
        leaseStartDate: "",
        leaseEndDate: "",
        coverPhoto: "",
        photos: [],
      });
    }
  }, [unit, form]);

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      console.log("Creating unit with data:", data);
      console.log("Property ID:", propertyId);
      return apiRequest("POST", `/api/properties/${propertyId}/units`, data);
    },
    onSuccess: () => {
      console.log("Unit created successfully");
      // Invalidate the specific property's units
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "units"] });
      // Invalidate the properties list to update counts/status
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      // Invalidate the filtered list used by Schedule page's Property Booking Settings
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      toast({
        title: "Unit created",
        description: "The unit has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Error creating unit:", error);
      let errorMessage = "Failed to create unit. Please try again.";
      
      // Try to extract more specific error information
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      apiRequest("PATCH", `/api/units/${unit!.id}`, data),
    onSuccess: () => {
      // Invalidate the specific property's units
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "units"] });
      // Invalidate the properties list to update counts/status
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      // Invalidate the filtered list used by Schedule page's Property Booking Settings
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      toast({
        title: "Unit updated",
        description: "The unit has been updated successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update unit. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setHoveredImageId(null);
      setOpenMenuId(null);
    }
    onOpenChange(newOpen);
  };

  // Compress and resize image - same as PropertyEdit
  const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('File is too large. Please use an image smaller than 10MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const aspectRatio = width / height;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
              if (height > maxHeight) {
                height = maxHeight;
                width = height * aspectRatio;
              }
            } else {
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
              if (width > maxWidth) {
                width = maxWidth;
                height = width / aspectRatio;
              }
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          if (compressedDataUrl.length > 5 * 1024 * 1024) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          }
          if (compressedDataUrl.length > 5 * 1024 * 1024) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
          }
          
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCoverPhotoClick = () => {
    coverPhotoInputRef.current?.click();
  };

  const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file, 1200, 800, 0.7);
        form.setValue("coverPhoto", compressedImage);
        toast({
          title: "Image processed",
          description: "Cover photo has been compressed and is ready to upload.",
        });
      } catch (error: any) {
        toast({
          title: "Error processing image",
          description: error.message || "Failed to process the image. Please try a smaller image.",
          variant: "destructive",
        });
      }
    }
    e.target.value = '';
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const compressedImages = await Promise.all(
          files.map(file => compressImage(file, 1200, 800, 0.7))
        );
        const currentGallery = form.getValues("photos") || [];
        form.setValue("photos", [...currentGallery, ...compressedImages]);
        toast({
          title: "Images processed",
          description: `${compressedImages.length} image(s) have been compressed and added to gallery.`,
        });
      } catch (error: any) {
        toast({
          title: "Error processing images",
          description: error.message || "Failed to process some images. Please try smaller images.",
          variant: "destructive",
        });
      }
    }
    e.target.value = '';
  };

  const handleSetAsCover = (imageUrl: string) => {
    form.setValue("coverPhoto", imageUrl);
    const currentGallery = form.getValues("photos") || [];
    form.setValue("photos", currentGallery.filter((url) => url !== imageUrl));
    setOpenMenuId(null);
    setHoveredImageId(null);
  };

  const handleDeleteImage = (imageUrl: string) => {
    const currentGallery = form.getValues("photos") || [];
    form.setValue("photos", currentGallery.filter((url) => url !== imageUrl));
    setOpenMenuId(null);
    setHoveredImageId(null);
  };

  const coverPhoto = form.watch("coverPhoto");
  const gallery = form.watch("photos") || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Unit" : "Add Unit"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the unit details below."
              : "Add a new unit to this property."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Images */}
              <div className="space-y-6">
                {/* Cover Photo */}
                <div>
                  <FormLabel className="text-base font-semibold mb-2 block">Cover Photo</FormLabel>
                  <div className="relative">
                    <div
                      onClick={handleCoverPhotoClick}
                      className="relative w-full aspect-video bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group"
                    >
                      {coverPhoto ? (
                        <>
                          <img
                            src={coverPhoto}
                            alt="Cover photo"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <button
                            type="button"
                            className="absolute bottom-3 right-3 z-10 p-2 rounded-full hover:bg-black/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              coverPhotoInputRef.current?.click();
                            }}
                          >
                            <Upload className="h-5 w-5 text-white drop-shadow-lg" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-8">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload cover photo</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={coverPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverPhotoChange}
                    />
                  </div>
                </div>

                {/* Gallery */}
                <div>
                  <FormLabel className="text-base font-semibold mb-2 block">Gallery</FormLabel>
                  
                  {/* Gallery Upload Box - Subtle */}
                  <div
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-muted-foreground/20 rounded-md cursor-pointer hover:border-primary/40 transition-colors bg-transparent hover:bg-muted/10 mb-3"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Add images</p>
                    </div>
                  </div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleGalleryUpload}
                  />

                  {/* Gallery Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Gallery Images */}
                    {gallery.map((imageUrl, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-lg overflow-hidden border border-border group cursor-pointer"
                          onMouseEnter={() => setHoveredImageId(`${index}`)}
                          onMouseLeave={() => {
                            if (openMenuId !== `${index}`) {
                              setHoveredImageId(null);
                            }
                          }}
                          onClick={() => {
                            if (openMenuId !== `${index}`) {
                              setOpenMenuId(`${index}`);
                              setHoveredImageId(`${index}`);
                            }
                          }}
                        >
                          <img
                            src={imageUrl}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {(hoveredImageId === `${index}` || openMenuId === `${index}`) && (
                            <div className="absolute inset-0 bg-black/20 flex items-end justify-end p-2">
                              <DropdownMenu
                                open={openMenuId === `${index}`}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setOpenMenuId(`${index}`);
                                    setHoveredImageId(`${index}`);
                                  } else {
                                    setOpenMenuId(null);
                                    setHoveredImageId(null);
                                  }
                                }}
                              >
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1.5 rounded hover:bg-black/20 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4 text-white drop-shadow-lg" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetAsCover(imageUrl);
                                    }}
                                  >
                                    Set as Cover Photo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(imageUrl);
                                    }}
                                    className="text-destructive"
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      ))}
                    
                    {/* Placeholder boxes when gallery is empty */}
                    {gallery.length === 0 && (
                      <>
                        {[1, 2, 3].map((placeholderIndex) => (
                          <div
                            key={placeholderIndex}
                            onClick={() => galleryInputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5 flex items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-muted/10 transition-colors"
                          >
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Form Fields */}
              <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 101, A, 1"
                        {...field}
                        data-testid="input-unit-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupancy Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select occupancy status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_occupied">Not Occupied</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Whether the unit currently has a tenant
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bedrooms *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        value={field.value}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }}
                        data-testid="input-bedrooms"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bathrooms *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 1.5, 2"
                        {...field}
                        data-testid="input-bathrooms"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="squareFeet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Square Feet</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        value={field.value || ""}
                        onChange={(e) => {
                          if (e.target.value === "") {
                            field.onChange(undefined);
                          } else {
                            const val = parseInt(e.target.value);
                            field.onChange(isNaN(val) ? undefined : val);
                          }
                        }}
                        data-testid="input-square-feet"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyRent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Rent</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 1500"
                        {...field}
                        data-testid="input-monthly-rent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deposit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 1500"
                        {...field}
                        data-testid="input-deposit"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="leaseStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-lease-start-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="leaseEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lease End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-lease-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isListed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Listing Status</FormLabel>
                    <FormDescription>
                      Listed units appear on the calendar for available bookings and in property booking settings (regardless of occupancy status)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-listed"
                    />
                  </FormControl>
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
                      placeholder="Marketing description for this unit..."
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customEventDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Event Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Override the property-level event description for this unit..."
                      {...field}
                      data-testid="textarea-custom-event-description"
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty to use the property's default event description. 
                    If set, this description will appear on the public booking page instead of the property-level description. 
                    Available variables: {"{unit_number}"}, {"{bedrooms}"}, {"{bathrooms}"}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this unit..."
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Update Unit" : "Add Unit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
