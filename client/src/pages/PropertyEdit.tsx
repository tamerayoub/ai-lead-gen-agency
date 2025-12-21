import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertPropertySchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, MoreVertical, Image as ImageIcon, ArrowLeft, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formSchema = insertPropertySchema.extend({
  units: z.coerce.number().int().min(1, "Must have at least 1 unit").default(1),
  occupancy: z.coerce.number().int().min(0, "Cannot be negative").default(0),
  monthlyRevenue: z.string().default("0"),
  coverPhoto: z.string().optional(),
  gallery: z.array(z.string()).default([]),
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
}).refine((data) => data.occupancy <= data.units, {
  message: "Occupancy cannot exceed total units",
  path: ["occupancy"],
});

type FormValues = z.infer<typeof formSchema>;

export default function PropertyEdit() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute("/properties/:id/edit");
  const [matchCreate] = useRoute("/properties/new");
  const isEdit = !!matchEdit;
  const isCreate = !!matchCreate;
  
  const propertyId = isEdit ? paramsEdit?.id : undefined;
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: property, isLoading: isLoadingProperty } = useQuery<any>({
    queryKey: ["/api/properties", propertyId],
    enabled: isEdit && !!propertyId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      units: 1,
      occupancy: 0,
      monthlyRevenue: "0",
      coverPhoto: "",
      gallery: [],
      description: "",
      amenities: [],
    },
  });

  useEffect(() => {
    if (isEdit && property) {
      form.reset({
        name: property.name || "",
        address: property.address || "",
        units: property.units || 1,
        occupancy: property.occupancy || 0,
        monthlyRevenue: property.monthlyRevenue || "0",
        coverPhoto: property.coverPhoto || "",
        gallery: property.gallery || [],
        description: property.description || "",
        amenities: property.amenities || [],
      });
    }
  }, [isEdit, property, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!propertyId) throw new Error("No property ID");
      const res = await apiRequest("PATCH", `/api/properties/${propertyId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Property updated",
        description: "The property has been successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] }); // Scheduling page
      setLocation("/properties");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update property",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/properties", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Property created",
        description: "The property has been successfully added",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] }); // Scheduling page
      setLocation("/properties");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create property",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
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

    // Ensure all fields are included, especially coverPhoto and gallery
    const submitData = {
      ...values,
      coverPhoto: values.coverPhoto || null,
      gallery: values.gallery || [],
    };

    if (isEdit) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  // Compress and resize image - more aggressive compression for smaller file size
  const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check file size first (10MB limit before compression)
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

          // Calculate new dimensions - ensure we scale down if needed
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

          // Use better quality settings for compression
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels to ensure we stay under size limit
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // If still too large, reduce quality further
          if (compressedDataUrl.length > 5 * 1024 * 1024) { // 5MB base64 limit
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
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const compressedImages = await Promise.all(
          files.map(file => compressImage(file, 1200, 800, 0.7))
        );
        const currentGallery = form.getValues("gallery") || [];
        form.setValue("gallery", [...currentGallery, ...compressedImages]);
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
    // Reset input so same files can be selected again
    e.target.value = '';
  };

  const handleSetAsCover = (imageUrl: string) => {
    form.setValue("coverPhoto", imageUrl);
    const currentGallery = form.getValues("gallery") || [];
    form.setValue("gallery", currentGallery.filter((url) => url !== imageUrl));
  };

  const handleDeleteImage = (imageUrl: string) => {
    const currentGallery = form.getValues("gallery") || [];
    form.setValue("gallery", currentGallery.filter((url) => url !== imageUrl));
  };

  const coverPhoto = form.watch("coverPhoto");
  const gallery = form.watch("gallery") || [];

  if (isLoadingProperty && isEdit) {
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
              {isEdit ? "Edit Property" : "Add New Property"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit ? "Update property details and images" : "Add a property to your portfolio"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
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
                                      setOpenMenuId(null);
                                      setHoveredImageId(null);
                                    }}
                                  >
                                    Set as Cover Photo
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(imageUrl);
                                      setOpenMenuId(null);
                                      setHoveredImageId(null);
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
                          rows={5}
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

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/properties")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending || createMutation.isPending}
                    className="flex-1"
                  >
                    {(updateMutation.isPending || createMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isEdit ? "Update Property" : "Create Property"}
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

