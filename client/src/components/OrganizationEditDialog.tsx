import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  phone: z.string().optional(),
  profileImage: z.string().optional().or(z.literal("")),
});

type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;

interface OrganizationEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export default function OrganizationEditDialog({ open, onOpenChange, organizationId }: OrganizationEditDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [imagePreview, setImagePreview] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const { data: organization, isLoading } = useQuery({
    queryKey: ["/api/organizations", organizationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${organizationId}`);
      return res.json();
    },
    enabled: open && !!organizationId,
    staleTime: 0, // Always fetch fresh data when dialog opens
  });

  // Check if user is owner of this organization
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: open && !!organizationId,
  });

  const isOwner = currentOrg?.orgId === organizationId && currentOrg?.role === 'owner';

  const form = useForm<UpdateOrganization>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: "",
      email: "",
      address: "",
      phone: "",
      profileImage: "",
    },
  });

  // Update form when organization data loads or dialog opens
  useEffect(() => {
    if (organization && open) {
      const orgData = {
        name: organization.name || "",
        email: organization.email || "",
        address: organization.address || "",
        phone: organization.phone || "",
        profileImage: organization.profileImage || "",
      };
      console.log("[OrganizationEditDialog] Resetting form with data:", orgData);
      form.reset(orgData, { keepDefaultValues: false });
      setImagePreview(organization.profileImage || "");
    } else if (open && !organization && !isLoading) {
      // Reset form when dialog opens but data hasn't loaded yet or doesn't exist
      form.reset({
        name: "",
        email: "",
        address: "",
        phone: "",
        profileImage: "",
      }, { keepDefaultValues: false });
      setImagePreview("");
    }
  }, [organization, open, form, isLoading]);

  const updateOrganizationMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("[OrganizationEditDialog] Sending update request:", data);
      const res = await apiRequest("PATCH", `/api/organizations/${organizationId}`, data);
      const result = await res.json();
      console.log("[OrganizationEditDialog] Update response:", result);
      return result;
    },
    onSuccess: (updatedOrg) => {
      console.log("[OrganizationEditDialog] Update successful:", updatedOrg);
      toast({
        title: "Organization updated",
        description: "Organization details have been updated successfully",
      });
      // Invalidate all organization-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId] });
      // Update the cache directly with the new data
      if (updatedOrg) {
        queryClient.setQueryData(["/api/organizations", organizationId], updatedOrg);
      }
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("[OrganizationEditDialog] Update error:", error);
      toast({
        title: "Failed to update organization",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/organizations/${organizationId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Organization deleted",
        description: data.message || "The organization has been permanently deleted. Your subscription has been cancelled immediately. This action cannot be undone.",
        duration: 8000,
      });
      // Invalidate all organization-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.removeQueries({ queryKey: ["/api/organizations"] });
      queryClient.removeQueries({ queryKey: ["/api/organizations/current"] });
      // Close dialog and redirect to home
      onOpenChange(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmationText("");
      // Redirect based on whether user has an organization with membership
      if (data.orgWithMembership) {
        // User has another org with membership - switch to it
        console.log('[OrganizationEditDialog] Redirecting to org with membership:', data.orgWithMembership.orgId);
        window.location.href = "/app";
      } else if (data.hasOtherOrgs) {
        // User has other orgs but none with membership - redirect to checkout
        console.log('[OrganizationEditDialog] User has other orgs but none with membership, redirecting to checkout');
        window.location.href = "/founding-partner-checkout";
      } else {
        // No other orgs - redirect to checkout
        console.log('[OrganizationEditDialog] No other orgs, redirecting to checkout');
        window.location.href = "/founding-partner-checkout";
      }
    },
    onError: (error: any) => {
      console.error("[OrganizationEditDialog] Delete error:", error);
      toast({
        title: "Failed to delete organization",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmationText === organization?.name) {
      deleteOrganizationMutation.mutate();
    }
  };

  function onSubmit(data: UpdateOrganization) {
    // Clean up empty strings to null for optional fields
    // Keep profileImage as-is (could be base64 data URL or regular URL)
    const cleanedData: any = {
      name: data.name,
      email: data.email || undefined,
      address: data.address || undefined,
      phone: data.phone || undefined,
    };
    
    // Only include profileImage if it has a value
    if (data.profileImage && data.profileImage.trim()) {
      cleanedData.profileImage = data.profileImage;
    }
    
    console.log("[OrganizationEditDialog] Submitting data:", cleanedData);
    updateOrganizationMutation.mutate(cleanedData);
  }

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      try {
        const compressedImage = await compressImage(file, 1200, 800, 0.7);
        setImagePreview(compressedImage);
        form.setValue("profileImage", compressedImage);
        toast({
          title: "Image processed",
          description: "Profile image has been compressed and is ready to save.",
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
  }

  const getInitials = () => {
    const name = form.watch("name");
    if (name) {
      return name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
    }
    return "PM";
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Edit Organization</DialogTitle>
          <DialogDescription className="text-xs">
            Update your organization details and branding
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            {/* Profile Image Section */}
            <div className="flex flex-col items-center gap-1.5 py-1 border-b">
              <Avatar className="h-12 w-12">
                <AvatarImage src={imagePreview || form.watch("profileImage") || undefined} />
                <AvatarFallback className="text-xs font-semibold text-black dark:text-white bg-gray-100 dark:bg-gray-800">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1 w-full max-w-md">
                <FormField
                  control={form.control}
                  name="profileImage"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-sm">Profile Image</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="https://example.com/image.jpg or upload from computer"
                            onChange={(e) => {
                              field.onChange(e);
                              setImagePreview(e.target.value);
                            }}
                            data-testid="input-org-profile-image"
                            className="h-8 text-sm"
                          />
                          <label htmlFor="file-upload-org" className="cursor-pointer">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              asChild
                            >
                              <span>
                                <Upload className="h-3.5 w-3.5" />
                              </span>
                            </Button>
                            <input
                              id="file-upload-org"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileSelect}
                            />
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Upload an image from your computer or enter an image URL
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-sm">Organization Name *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""}
                      placeholder={organization?.name || "My Property Management Company"} 
                      data-testid="input-org-name" 
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-sm">Email</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""}
                      type="email" 
                      placeholder={organization?.email || "contact@company.com"} 
                      data-testid="input-org-email"
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-sm">Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""}
                      placeholder={organization?.phone || "+1 (555) 123-4567"} 
                      data-testid="input-org-phone"
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-sm">Address</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ""}
                      placeholder={organization?.address || "123 Main St, City, State ZIP"} 
                      data-testid="input-org-address"
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2 mt-2 pt-2 border-t">
              {isOwner && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
                  className="sm:mr-auto"
                  data-testid="button-delete-org"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Organization
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-edit-org"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganizationMutation.isPending}
                  data-testid="button-save-edit-org"
                >
                  {updateOrganizationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="font-semibold text-foreground text-destructive">
                This will permanently delete your organization immediately. This action cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground">
                This action will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li><strong>Cancel your subscription immediately</strong> - Your Stripe subscription will be cancelled immediately</li>
                <li><strong>Permanently delete the organization</strong> - The organization will be deleted from the database immediately</li>
                <li><strong>Delete all data</strong> - All properties, leads, conversations, team members, and related data will be permanently removed</li>
                <li><strong>Cannot be undone</strong> - This is a permanent deletion. There is no way to restore the organization or recover any data</li>
              </ul>
              <div className="pt-4 space-y-2">
                <p className="font-semibold text-foreground">
                  To confirm, please type <span className="font-mono bg-muted px-1 rounded">{organization?.name}</span> below:
                </p>
                <Input
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder={organization?.name}
                  className="mt-2"
                  data-testid="input-delete-confirmation"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmationText("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmationText !== organization?.name || deleteOrganizationMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-org"
            >
              {deleteOrganizationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Organization"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

