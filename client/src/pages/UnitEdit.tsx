import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPropertyUnitSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, MoreVertical, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Create a form schema that matches what the server expects
// The server uses: insertPropertyUnitSchema.omit({ propertyId: true, orgId: true })
// We need to also make fields with database defaults optional in the form
const formSchema = insertPropertyUnitSchema
  .omit({ 
    propertyId: true, 
    orgId: true,
    // These have database defaults, so make them optional in the form
    bookingEnabled: true,
    hasCustomBookingType: true,
    bookingTypeDeleted: true,
  })
  .extend({
    coverPhoto: z.string().optional().nullable(),
    photos: z.array(z.string()).optional().default([]),
    // Allow empty strings for optional text fields
    monthlyRent: z.string().optional().nullable().or(z.literal("")),
    deposit: z.string().optional().nullable().or(z.literal("")),
    description: z.string().optional().nullable().or(z.literal("")),
    customEventDescription: z.string().optional().nullable().or(z.literal("")),
    notes: z.string().optional().nullable().or(z.literal("")),
    leaseStartDate: z.string().optional().nullable().or(z.literal("")),
    leaseEndDate: z.string().optional().nullable().or(z.literal("")),
    // Facebook Marketplace amenities
    laundryType: z.enum(['In-unit laundry', 'Laundry in building', 'Laundry available', 'None']).optional().nullable(),
    parkingType: z.enum(['Garage parking', 'Street parking', 'Off-street parking', 'Parking available', 'None']).optional().nullable(),
    airConditioningType: z.enum(['Central AC', 'AC Available', 'None']).optional().nullable(),
    heatingType: z.enum(['Central Heat', 'Gas Heat', 'Electric Heat', 'Radiator Heat', 'Heating Available', 'None']).optional().nullable(),
    catFriendly: z.boolean().optional().default(false),
    dogFriendly: z.boolean().optional().default(false),
  })
  .omit({ isListed: true });

type FormValues = z.infer<typeof formSchema>;

export default function UnitEdit() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/units/:id/edit");
  const [matchCreate, paramsCreate] = useRoute("/properties/:propertyId/units/new");
  const isEdit = !!matchEdit;
  const isCreate = !!matchCreate;
  
  const unitId = isEdit ? paramsEdit?.id : undefined;
  const propertyId = isCreate ? paramsCreate?.propertyId : undefined;
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: unit, isLoading: isLoadingUnit } = useQuery<any>({
    queryKey: ["/api/units", unitId],
    enabled: isEdit && !!unitId,
  });

  const { data: property } = useQuery<any>({
    queryKey: ["/api/properties", isEdit ? unit?.propertyId : propertyId],
    enabled: (isEdit && !!unit?.propertyId) || (isCreate && !!propertyId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitNumber: "",
      bedrooms: 0,
      bathrooms: "",
      squareFeet: undefined,
      monthlyRent: "",
      deposit: "",
      status: "not_occupied",
      description: "",
      amenities: [],
      customEventDescription: "",
      notes: "",
      coverPhoto: "",
      photos: [],
      laundryType: null,
      parkingType: null,
      airConditioningType: null,
      heatingType: null,
      catFriendly: false,
      dogFriendly: false,
    },
  });

  useEffect(() => {
    if (isEdit && unit) {
      form.reset({
        unitNumber: unit.unitNumber || "",
        bedrooms: unit.bedrooms || 0,
        bathrooms: unit.bathrooms || "",
        squareFeet: unit.squareFeet || undefined,
        monthlyRent: unit.monthlyRent || "",
        deposit: unit.deposit || "",
      status: unit.status || "not_occupied",
      description: unit.description || "",
        amenities: unit.amenities || [],
        customEventDescription: unit.customEventDescription || "",
        notes: unit.notes || "",
        coverPhoto: unit.coverPhoto || "",
        photos: unit.photos || [],
        laundryType: unit.laundryType || null,
        parkingType: unit.parkingType || null,
        airConditioningType: unit.airConditioningType || null,
        heatingType: unit.heatingType || null,
        catFriendly: unit.catFriendly || false,
        dogFriendly: unit.dogFriendly || false,
      });
    } else if (isCreate) {
      // Reset form to defaults when in create mode
      form.reset({
        unitNumber: "",
        bedrooms: 0,
        bathrooms: "",
        squareFeet: undefined,
        monthlyRent: "",
        deposit: "",
      status: "not_occupied",
      description: "",
        amenities: [],
        customEventDescription: "",
        notes: "",
        coverPhoto: "",
        photos: [],
        laundryType: null,
        parkingType: null,
        airConditioningType: null,
        heatingType: null,
        catFriendly: false,
        dogFriendly: false,
      });
    }
  }, [isEdit, isCreate, unit, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!propertyId) {
        console.error("No property ID available for unit creation");
        throw new Error("No property ID");
      }
      console.log("Creating unit with propertyId:", propertyId, "data:", data);
      try {
        const res = await apiRequest("POST", `/api/properties/${propertyId}/units`, data);
        return await res.json();
      } catch (error: any) {
        console.error("Unit creation API error:", error);
        throw error;
      }
    },
    onSuccess: (createdUnit) => {
      console.log("Unit created successfully:", createdUnit);
      toast({
        title: "Unit created",
        description: "The unit has been successfully created",
      });
      // Invalidate queries to refresh the data everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] }); // Scheduling page
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "units"] });
        queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId] });
      }
      // Navigate back to the property detail view to see the new unit
      setLocation(`/properties/${propertyId}`);
    },
    onError: (error: any) => {
      console.error("Unit creation error:", error);
      toast({
        title: "Failed to create unit",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!unitId) {
        console.error("No unit ID available for unit update");
        throw new Error("No unit ID");
      }
      console.log("Updating unit with unitId:", unitId, "data:", data);
      try {
        const res = await apiRequest("PATCH", `/api/units/${unitId}`, data);
        return await res.json();
      } catch (error: any) {
        console.error("Unit update API error:", error);
        throw error;
      }
    },
    onSuccess: (updatedUnit) => {
      console.log("Unit updated successfully:", updatedUnit);
      toast({
        title: "Unit updated",
        description: "The unit has been successfully updated",
      });
      // Invalidate queries to refresh the data everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] }); // Scheduling page
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      if (unit?.propertyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/properties", unit.propertyId, "units"] });
        queryClient.invalidateQueries({ queryKey: ["/api/properties", unit.propertyId] });
      }
      // Navigate back to the property detail view to see the updated unit
      if (unit?.propertyId) {
        setLocation(`/properties/${unit.propertyId}`);
      } else {
        setLocation("/properties");
      }
    },
    onError: (error: any) => {
      console.error("Unit update error:", error);
      toast({
        title: "Failed to update unit",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    console.log("=== handleSubmit START ===");
    console.log("Form values received:", values);
    console.log("Form state:", { isEdit, isCreate, propertyId, unitId, location });
    console.log("Form errors:", form.formState.errors);
    console.log("Form is valid:", form.formState.isValid);
    
    // Validate that we have the required propertyId for create mode
    if (isCreate && !propertyId) {
      toast({
        title: "Error",
        description: "Property ID is missing. Please try again.",
        variant: "destructive",
      });
      console.error("Missing propertyId in create mode");
      return;
    }

    // Validate required fields
    if (!values.unitNumber || !values.unitNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Unit number is required.",
        variant: "destructive",
      });
      return;
    }

    if (values.bedrooms === undefined || values.bedrooms < 0) {
      toast({
        title: "Validation Error",
        description: "Bedrooms must be 0 or greater.",
        variant: "destructive",
      });
      return;
    }

    if (!values.bathrooms || !values.bathrooms.trim()) {
      toast({
        title: "Validation Error",
        description: "Bathrooms is required.",
        variant: "destructive",
      });
      return;
    }

    // Check total payload size before submitting
    const payload = JSON.stringify(values);
    const payloadSizeMB = payload.length / (1024 * 1024);
    
    if (payloadSizeMB > 40) {
      toast({
        title: "Payload too large",
        description: `Total data size is ${payloadSizeMB.toFixed(2)}MB. Please reduce image sizes or remove some images.`,
        variant: "destructive",
      });
      return;
    }

    // Prepare submit data - only include fields that are in the schema
    // Remove empty strings and convert to null where appropriate
    const submitData: any = {
      unitNumber: values.unitNumber.trim(),
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms.trim(),
      status: values.status,
    };

    // Optional fields - only include if they have values
    if (values.squareFeet !== undefined && values.squareFeet !== null) {
      submitData.squareFeet = values.squareFeet;
    }
    if (values.monthlyRent && values.monthlyRent.trim()) {
      submitData.monthlyRent = values.monthlyRent.trim();
    }
    if (values.deposit && values.deposit.trim()) {
      submitData.deposit = values.deposit.trim();
    }
    if (values.description && values.description.trim()) {
      submitData.description = values.description.trim();
    }
    if (values.amenities && values.amenities.length > 0) {
      submitData.amenities = values.amenities;
    }
    if (values.customEventDescription && values.customEventDescription.trim()) {
      submitData.customEventDescription = values.customEventDescription.trim();
    }
    if (values.notes && values.notes.trim()) {
      submitData.notes = values.notes.trim();
    }
    // Facebook Marketplace amenities - include even if null/None to allow clearing
    if (values.laundryType !== undefined) {
      submitData.laundryType = values.laundryType || null;
    }
    if (values.parkingType !== undefined) {
      submitData.parkingType = values.parkingType || null;
    }
    if (values.airConditioningType !== undefined) {
      submitData.airConditioningType = values.airConditioningType || null;
    }
    if (values.heatingType !== undefined) {
      submitData.heatingType = values.heatingType || null;
    }
    // Pet-friendly fields
    if (values.catFriendly !== undefined) {
      submitData.catFriendly = values.catFriendly;
    }
    if (values.dogFriendly !== undefined) {
      submitData.dogFriendly = values.dogFriendly;
    }
    if (values.coverPhoto && values.coverPhoto.trim()) {
      submitData.coverPhoto = values.coverPhoto.trim();
    }
    if (values.photos && values.photos.length > 0) {
      submitData.photos = values.photos;
    }

    console.log("Submitting unit:", { isEdit, isCreate, propertyId, unitId, submitData });

    // Validate unitId for edit mode
    if (isEdit && !unitId) {
      toast({
        title: "Error",
        description: "Unit ID is missing. Please try again.",
        variant: "destructive",
      });
      console.error("Missing unitId in edit mode");
      return;
    }

    if (isEdit) {
      console.log("=== CALLING updateMutation ===");
      console.log("Update data:", submitData);
      updateMutation.mutate(submitData, {
        onError: (error) => {
          console.error("Update mutation error:", error);
        },
        onSuccess: (data) => {
          console.log("Update mutation success:", data);
        },
      });
    } else if (isCreate) {
      console.log("=== CALLING createMutation ===");
      console.log("Create data:", submitData);
      createMutation.mutate(submitData, {
        onError: (error) => {
          console.error("Create mutation error:", error);
        },
        onSuccess: (data) => {
          console.log("Create mutation success:", data);
        },
      });
    } else {
      toast({
        title: "Error",
        description: "Unable to determine if creating or editing unit.",
        variant: "destructive",
      });
      console.error("Neither isEdit nor isCreate is true", { isEdit, isCreate, location });
    }
    console.log("=== handleSubmit END ===");
  };

  // Compress and resize image
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
  };

  const handleDeleteImage = (imageUrl: string) => {
    const currentGallery = form.getValues("photos") || [];
    form.setValue("photos", currentGallery.filter((url) => url !== imageUrl));
  };

  const coverPhoto = form.watch("coverPhoto");
  const gallery = form.watch("photos") || [];

  if (isLoadingUnit && isEdit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/properties")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">
              {isEdit ? "Edit Unit" : "Add New Unit"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit 
                ? (property ? `${property.name} - Unit ${unit?.unitNumber || ''}` : 'Update unit details and images')
                : (property ? `Add a new unit to ${property.name}` : 'Add a new unit to your property')
              }
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error("Form validation errors:", errors);
            const errorMessages = Object.entries(errors).map(([field, error]: [string, any]) => {
              return `${field}: ${error?.message || 'Invalid value'}`;
            }).join(', ');
            toast({
              title: "Validation Error",
              description: `Please fix the following errors: ${errorMessages}`,
              variant: "destructive",
            });
          })}>
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
              <div className="space-y-6">
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
                            <SelectTrigger>
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
                            value={field.value || ""}
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
                            value={field.value || ""}
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
                    name="laundryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Laundry Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select laundry type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="In-unit laundry">In-unit laundry</SelectItem>
                            <SelectItem value="Laundry in building">Laundry in building</SelectItem>
                            <SelectItem value="Laundry available">Laundry available</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parkingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parking Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select parking type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Garage parking">Garage parking</SelectItem>
                            <SelectItem value="Street parking">Street parking</SelectItem>
                            <SelectItem value="Off-street parking">Off-street parking</SelectItem>
                            <SelectItem value="Parking available">Parking available</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="airConditioningType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Air Conditioning Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select AC type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Central AC">Central AC</SelectItem>
                            <SelectItem value="AC Available">AC Available</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="heatingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heating Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select heating type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Central Heat">Central Heat</SelectItem>
                            <SelectItem value="Gas Heat">Gas Heat</SelectItem>
                            <SelectItem value="Electric Heat">Electric Heat</SelectItem>
                            <SelectItem value="Radiator Heat">Radiator Heat</SelectItem>
                            <SelectItem value="Heating Available">Heating Available</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Pet-friendly options */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="catFriendly"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Cat Friendly
                          </FormLabel>
                          <FormDescription>
                            Allow cats in this unit
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dogFriendly"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Dog Friendly
                          </FormLabel>
                          <FormDescription>
                            Allow dogs in this unit
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

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
                          value={field.value || ""}
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
                          value={field.value || ""}
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty to use the property's default event description.
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
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/properties")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isEdit ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

