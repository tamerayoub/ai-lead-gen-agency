import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Trash2,
  Home,
  ClipboardCheck,
  ExternalLink,
  Settings,
  Pencil,
  Loader2,
  AlertCircle,
  Download,
  Facebook,
  ImageIcon,
  Calendar,
} from "lucide-react";
import type { Listing, Property, PropertyUnit } from "@shared/schema";
import { useLocation } from "wouter";

type ListingWithDetails = Listing & {
  property?: Property;
  unit?: PropertyUnit;
};

export default function Listings() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [preQualifyEnabled, setPreQualifyEnabled] = useState(false);
  const [acceptBookings, setAcceptBookings] = useState(true);
  const [listToFacebook, setListToFacebook] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<ListingWithDetails | null>(null);
  const [editPropertyId, setEditPropertyId] = useState<string>("");
  const [editUnitId, setEditUnitId] = useState<string>("");
  const [editPreQualifyEnabled, setEditPreQualifyEnabled] = useState(false);
  const [editAcceptBookings, setEditAcceptBookings] = useState(true);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkingListing, setLinkingListing] = useState<ListingWithDetails | null>(null);
  const [linkPropertyId, setLinkPropertyId] = useState<string>("");
  const [linkUnitId, setLinkUnitId] = useState<string>("");

  const { data: listings = [], isLoading: listingsLoading, refetch: refetchListings } = useQuery<ListingWithDetails[]>({
    queryKey: ["/api/listings"],
    refetchInterval: 5000, // Refetch every 5 seconds to check for Facebook upload status updates
  });
  
  // Track which listings are currently being uploaded to Facebook
  const [facebookUploadStatus, setFacebookUploadStatus] = useState<Record<string, 'loading' | 'success' | 'failed'>>({});
  
  // Determine Facebook status for each listing
  // Only show "Uploading" when we explicitly triggered a Facebook post (listToFacebook was true at creation)
  const getFacebookStatus = (listing: ListingWithDetails): 'loading' | 'success' | 'failed' | null => {
    // Success: Has Facebook listing ID
    if (listing.facebookListingId) {
      return 'success';
    }
    
    // Only show loading/failed when we have explicit status (set when listToFacebook=true at creation)
    // Never infer "uploading" from recency — listings created with listToFacebook=false should show nothing
    if (facebookUploadStatus[listing.id]) {
      return facebookUploadStatus[listing.id];
    }
    
    return null; // No status (not posted to Facebook, or user chose not to list there)
  };

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch units for the selected property (only when a property is selected)
  // Uses standard query client fetcher that handles errors and auth properly
  const { data: propertyUnits = [], isError: unitsError, isLoading: unitsLoading } = useQuery<PropertyUnit[]>({
    queryKey: ["/api/properties", selectedPropertyId, "units"],
    enabled: !!selectedPropertyId,
  });

  // Fetch units for the property selected in the edit dialog
  const {
    data: editPropertyUnits = [],
    isError: editUnitsError,
    isLoading: editUnitsLoading,
  } = useQuery<PropertyUnit[]>({
    queryKey: ["/api/properties", editPropertyId, "units"],
    enabled: !!editPropertyId && isEditDialogOpen,
  });

  // Fetch units for the property selected in the link dialog
  const {
    data: linkPropertyUnits = [],
    isError: linkUnitsError,
    isLoading: linkUnitsLoading,
  } = useQuery<PropertyUnit[]>({
    queryKey: ["/api/properties", linkPropertyId, "units"],
    enabled: !!linkPropertyId && isLinkDialogOpen,
  });
  
  
  const createListingMutation = useMutation({
    mutationFn: async (data: { propertyId: string; unitId: string; preQualifyEnabled: boolean; acceptBookings: boolean; listToFacebook: boolean }) => {
      const res = await apiRequest("POST", "/api/listings", {
        propertyId: data.propertyId,
        unitId: data.unitId,
        status: "active",
        preQualifyEnabled: data.preQualifyEnabled,
        acceptBookings: data.acceptBookings,
        listToFacebook: data.listToFacebook,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to create listing" }));
        throw new Error(errorData.message || `HTTP ${res.status}: Failed to create listing`);
      }
      
      const listingData = await res.json();
      console.log('[Listings] Listing created:', listingData);
      return listingData;
    },
    onSuccess: async (data, variables) => {
      console.log('[Listings] Listing creation successful:', data);
      console.log('[Listings] List to Facebook:', variables.listToFacebook);
      
      // Track Facebook upload status if listToFacebook was enabled
      if (variables.listToFacebook && data?.id) {
        console.log('[Listings] Setting Facebook upload status to loading for listing:', data.id);
        setFacebookUploadStatus(prev => ({
          ...prev,
          [data.id]: 'loading',
        }));
      }
      
      // Close dialog and reset form first
      setIsCreateDialogOpen(false);
      resetForm();
      
      // Immediately invalidate and refetch queries to show the new listing
      await queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      await queryClient.refetchQueries({ queryKey: ["/api/listings"] });
      
      // If listToFacebook was enabled, set up periodic checks for Facebook upload status
      if (variables.listToFacebook && data?.id) {
        // Check every 3 seconds to detect when Playwright saves the listing ID
        const checkInterval1 = setInterval(async () => {
          console.log('[Listings] Checking Facebook upload status...');
          // Use refetchQueries to immediately fetch updated data
          await queryClient.refetchQueries({ queryKey: ["/api/listings"] });
          
          // Check if the listing now has facebookListingId - if so, clear the interval early
          const updatedListings = queryClient.getQueryData<ListingWithDetails[]>(["/api/listings"]);
          const updatedListing = updatedListings?.find(l => l.id === data.id);
          if (updatedListing?.facebookListingId) {
            console.log('[Listings] ✅ Facebook upload completed, stopping interval check');
            clearInterval(checkInterval1);
            setFacebookUploadStatus(prev => ({
              ...prev,
              [data.id]: 'success',
            }));
          }
        }, 3000);
        
        // Clear interval after 10 minutes (600 seconds) as safety
        setTimeout(() => {
          clearInterval(checkInterval1);
          console.log('[Listings] Stopped checking Facebook upload status after 10 minutes');
        }, 600000);
      }
      
      // Show success toast
      toast({
        title: "Listing created",
        description: variables.listToFacebook 
          ? "The unit listing has been created successfully. Facebook upload is in progress..."
          : "The unit listing has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('[Listings] Error creating listing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create listing",
        variant: "destructive",
      });
    },
  });

  const toggleListingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const res = await apiRequest("PATCH", `/api/listings/${id}`, { status: newStatus });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      const newStatus = variables.status === "active" ? "inactive" : "active";
      toast({
        title: newStatus === "active" ? "Listing is listed" : "Listing is deactivated",
        description: newStatus === "active" 
          ? "The listing has been activated and booking is enabled." 
          : "The listing has been deactivated and booking is disabled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update listing status",
        variant: "destructive",
      });
    },
  });

  const togglePreQualifyMutation = useMutation({
    mutationFn: async ({ id, preQualifyEnabled }: { id: string; preQualifyEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/listings/${id}`, { preQualifyEnabled: !preQualifyEnabled });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Pre-qualification updated",
        description: "Pre-qualification setting has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pre-qualification setting",
        variant: "destructive",
      });
    },
  });

  const toggleAcceptBookingsMutation = useMutation({
    mutationFn: async ({ id, acceptBookings }: { id: string; acceptBookings: boolean }) => {
      const res = await apiRequest("PATCH", `/api/listings/${id}`, {
        acceptBookings: !acceptBookings,
      });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      toast({
        title: variables.acceptBookings ? "Bookings disabled" : "Bookings enabled",
        description: "Accept bookings setting has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking setting",
        variant: "destructive",
      });
    },
  });

  const updateListingMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      propertyId: string;
      unitId: string;
      preQualifyEnabled: boolean;
      acceptBookings: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/listings/${data.id}`, {
        propertyId: data.propertyId,
        unitId: data.unitId,
        preQualifyEnabled: data.preQualifyEnabled,
        acceptBookings: data.acceptBookings,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      setIsEditDialogOpen(false);
      setEditingListing(null);
      toast({
        title: "Listing updated",
        description: "The listing has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update listing",
        variant: "destructive",
      });
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Listing deleted",
        description: "The listing has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete listing",
        variant: "destructive",
      });
    },
  });

  const linkListingMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      propertyId: string;
      unitId: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/listings/${data.id}/link`, {
        propertyId: data.propertyId,
        unitId: data.unitId,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      setIsLinkDialogOpen(false);
      setLinkingListing(null);
      setLinkPropertyId("");
      setLinkUnitId("");
      toast({
        title: "Listing linked",
        description: "The listing has been successfully linked to the property and unit.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link listing",
        variant: "destructive",
      });
    },
  });

  const importFacebookListingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/listings/import-facebook", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Facebook listings imported",
        description: data.message || `Imported ${data.imported || 0} listings from Facebook Marketplace.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import Facebook listings",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedPropertyId("");
    setSelectedUnitId("");
    setPreQualifyEnabled(false);
    setAcceptBookings(true);
    setListToFacebook(false);
  };

  const resetEditForm = () => {
    setEditPropertyId("");
    setEditUnitId("");
    setEditPreQualifyEnabled(false);
    setEditAcceptBookings(true);
    setEditingListing(null);
  };

  const openEditDialog = (listing: ListingWithDetails) => {
    setEditingListing(listing);
    setEditPropertyId(listing.propertyId);
    setEditUnitId(listing.unitId);
    setEditPreQualifyEnabled(listing.preQualifyEnabled ?? false);
    setEditAcceptBookings(listing.acceptBookings ?? true);
    setIsEditDialogOpen(true);
  };

  const openLinkDialog = (listing: ListingWithDetails) => {
    setLinkingListing(listing);
    setLinkPropertyId("");
    setLinkUnitId("");
    setIsLinkDialogOpen(true);
  };

  const handleLinkListing = () => {
    if (!linkingListing || !linkPropertyId || !linkUnitId) {
      toast({
        title: "Missing information",
        description: "Please select a property and unit to link.",
        variant: "destructive",
      });
      return;
    }
    linkListingMutation.mutate({
      id: linkingListing.id,
      propertyId: linkPropertyId,
      unitId: linkUnitId,
    });
  };

  const handleUpdateListing = () => {
    if (!editingListing || !editPropertyId || !editUnitId) {
      toast({
        title: "Missing information",
        description: "Please select a property and unit.",
        variant: "destructive",
      });
      return;
    }

    updateListingMutation.mutate({
      id: editingListing.id,
      propertyId: editPropertyId,
      unitId: editUnitId,
      preQualifyEnabled: editPreQualifyEnabled,
      acceptBookings: editAcceptBookings,
    });
  };

  const handleCreateListing = () => {
    if (!selectedPropertyId || !selectedUnitId) {
      toast({
        title: "Missing information",
        description: "Please select a property and unit.",
        variant: "destructive",
      });
      return;
    }
    createListingMutation.mutate({
      propertyId: selectedPropertyId,
      unitId: selectedUnitId,
      preQualifyEnabled,
      acceptBookings,
      listToFacebook,
    });
  };

  // Get unit IDs that are already listed
  const listedUnitIds = new Set(listings.map(l => l.unitId));
  
  // Filter units: must not already be listed
  const filteredUnits = propertyUnits.filter(u => !listedUnitIds.has(u.id));

  // Filter units for edit: allow the currently selected unit, but block other already listed ones
  const filteredEditUnits = editPropertyUnits.filter(
    (u) => u.id === editUnitId || !listedUnitIds.has(u.id)
  );

  useEffect(() => {
    const search = location.split("?")[1];
    if (!search) return;
    const params = new URLSearchParams(search);
    const editId = params.get("edit");
    const createParam = params.get("create");
    const propertyIdParam = params.get("propertyId");
    const unitIdParam = params.get("unitId");
    
    if (editId && listings.length > 0) {
      const listingToEdit = listings.find((l) => l.id === editId);
      if (listingToEdit) {
        openEditDialog(listingToEdit);
        const basePath = location.split("?")[0];
        setLocation(basePath);
      }
    } else if (createParam === "true" && propertyIdParam && unitIdParam) {
      // Open create dialog with pre-selected property and unit
      setSelectedPropertyId(propertyIdParam);
      setSelectedUnitId(unitIdParam);
      setIsCreateDialogOpen(true);
      const basePath = location.split("?")[0];
      setLocation(basePath);
    }
  }, [location, listings]);

  // Update Facebook upload status based on listing data
  // Mark as success when facebookListingId is saved, or failed if timeout exceeded
  useEffect(() => {
    const now = new Date();
    setFacebookUploadStatus(prev => {
      const updatedStatus: Record<string, 'loading' | 'success' | 'failed'> = { ...prev };
      let hasChanges = false;
      
      listings.forEach(listing => {
        // If listing has facebookListingId, mark as success (regardless of previous status)
        if (listing.facebookListingId) {
          if (updatedStatus[listing.id] !== 'success') {
            updatedStatus[listing.id] = 'success';
            hasChanges = true;
            console.log(`[Listings] ✅ Facebook upload succeeded for listing ${listing.id}, ID: ${listing.facebookListingId}`);
          }
        } else if (listing.createdAt && updatedStatus[listing.id] === 'loading') {
          // Listing was being uploaded but doesn't have facebookListingId yet
          const createdAt = new Date(listing.createdAt);
          const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          
          // If created more than 10 minutes ago without facebookListingId and we were tracking it as loading, mark as failed
          if (minutesSinceCreation >= 10) {
            updatedStatus[listing.id] = 'failed';
            hasChanges = true;
            console.log(`[Listings] ❌ Facebook upload failed for listing ${listing.id} (timeout after ${minutesSinceCreation.toFixed(1)} minutes)`);
          }
        }
      });
      
      return hasChanges ? updatedStatus : prev;
    });
  }, [listings]);

  const filteredListings = listings.filter(listing => {
    const property = listing.property || properties.find(p => p.id === listing.propertyId);
    const unit = listing.unit;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      property?.name?.toLowerCase().includes(searchLower) ||
      unit?.unitNumber?.toLowerCase().includes(searchLower) ||
      property?.address?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPropertyName = (propertyId: string) => {
    const listing = listings.find(l => l.propertyId === propertyId);
    return listing?.property?.name || properties.find(p => p.id === propertyId)?.name || "Unknown Property";
  };

  const getUnitNumber = (unitId: string) => {
    const listing = listings.find(l => l.unitId === unitId);
    return listing?.unit?.unitNumber || "Unknown Unit";
  };

  const getUnitDetails = (unitId: string) => {
    const listing = listings.find(l => l.unitId === unitId);
    const unit = listing?.unit;
    if (!unit) return null;
    return {
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      rent: unit.monthlyRent,
    };
  };

  const isImportedFromFacebook = (listing: ListingWithDetails): boolean => {
    const property = listing.property || properties.find(p => p.id === listing.propertyId);
    return property?.name === "Facebook Imported Listings" || 
           listing.title?.includes("Facebook Listing") === true;
  };

  const isUnlinkedListing = (listing: ListingWithDetails): boolean => {
    const property = listing.property || properties.find(p => p.id === listing.propertyId);
    const unit = listing.unit;
    // Check if it's a placeholder unit (FB-{id} format) or in Facebook Imported Listings property
    return (property?.name === "Facebook Imported Listings" && unit?.unitNumber?.startsWith("FB-")) ||
           (unit?.unitNumber?.startsWith("FB-") && unit?.bedrooms === 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Listings</h1>
          <p className="text-muted-foreground">
            Manage your active unit listings and pre-qualification settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => importFacebookListingsMutation.mutate()}
            disabled={importFacebookListingsMutation.isPending}
          >
            {importFacebookListingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Facebook Listings
              </>
            )}
          </Button>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-listing">
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Listing</DialogTitle>
              <DialogDescription>
                Create a listing for a unit to make it available for public booking
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property</Label>
                <Select value={selectedPropertyId} onValueChange={(val) => {
                  setSelectedPropertyId(val);
                  setSelectedUnitId("");
                }}>
                  <SelectTrigger data-testid="select-property">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(property => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select 
                  value={selectedUnitId} 
                  onValueChange={setSelectedUnitId}
                  disabled={!selectedPropertyId || filteredUnits.length === 0}
                >
                  <SelectTrigger data-testid="select-unit">
                    <SelectValue placeholder={
                      !selectedPropertyId 
                        ? "Select a property first" 
                        : unitsLoading
                          ? "Loading units..."
                          : filteredUnits.length === 0 
                            ? "No available units" 
                            : "Select a unit"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUnits.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Unit {unit.unitNumber} - {unit.bedrooms}BR/{unit.bathrooms}BA - ${unit.monthlyRent}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPropertyId && unitsError && (
                  <p className="text-sm text-destructive">
                    Failed to load units. Please try again.
                  </p>
                )}
                {selectedPropertyId && !unitsError && filteredUnits.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    All units in this property are already listed.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="prequalify">Require Pre-Qualification</Label>
                  <p className="text-sm text-muted-foreground">
                    Leads must answer qualification questions before booking
                  </p>
                </div>
                <Switch
                  id="prequalify"
                  checked={preQualifyEnabled}
                  onCheckedChange={setPreQualifyEnabled}
                  data-testid="switch-prequalify"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="acceptBookings">Accept Bookings</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow leads to book showings for this listing
                  </p>
                </div>
                <Switch
                  id="acceptBookings"
                  checked={acceptBookings}
                  onCheckedChange={setAcceptBookings}
                  data-testid="switch-accept-bookings"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="listToFacebook">List to Facebook?</Label>
                  <p className="text-sm text-muted-foreground">
                    Push this listing to Facebook Marketplace (requires Facebook integration)
                  </p>
                </div>
                <Switch
                  id="listToFacebook"
                  checked={listToFacebook}
                  onCheckedChange={setListToFacebook}
                  data-testid="switch-list-to-facebook"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateListing}
                disabled={!selectedPropertyId || !selectedUnitId || createListingMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createListingMutation.isPending ? "Creating..." : "Create Listing"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) resetEditForm();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Listing</DialogTitle>
              <DialogDescription>
                Update listing details for this unit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-property">Property</Label>
                <Select
                  value={editPropertyId}
                  onValueChange={(val) => {
                    setEditPropertyId(val);
                    setEditUnitId("");
                  }}
                  disabled={!editingListing}
                >
                  <SelectTrigger data-testid="select-edit-property">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit</Label>
                <Select
                  value={editUnitId}
                  onValueChange={setEditUnitId}
                  disabled={!editPropertyId || filteredEditUnits.length === 0}
                >
                  <SelectTrigger data-testid="select-edit-unit">
                    <SelectValue
                      placeholder={
                        !editPropertyId
                          ? "Select a property first"
                          : editUnitsLoading
                          ? "Loading units..."
                          : filteredEditUnits.length === 0
                          ? "No available units"
                          : "Select a unit"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEditUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Unit {unit.unitNumber} - {unit.bedrooms}BR/{unit.bathrooms}BA - ${unit.monthlyRent}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editPropertyId && editUnitsError && (
                  <p className="text-sm text-destructive">
                    Failed to load units. Please try again.
                  </p>
                )}
                {editPropertyId && !editUnitsError && filteredEditUnits.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    All units in this property are already listed.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-prequalify">Require Pre-Qualification</Label>
                  <p className="text-sm text-muted-foreground">
                    Leads must answer qualification questions before booking
                  </p>
                </div>
                <Switch
                  id="edit-prequalify"
                  checked={editPreQualifyEnabled}
                  onCheckedChange={setEditPreQualifyEnabled}
                  data-testid="switch-edit-prequalify"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-acceptBookings">Accept Bookings</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow leads to book showings for this listing
                  </p>
                </div>
                <Switch
                  id="edit-acceptBookings"
                  checked={editAcceptBookings}
                  onCheckedChange={setEditAcceptBookings}
                  data-testid="switch-edit-accept-bookings"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateListing}
                disabled={
                  !editPropertyId ||
                  !editUnitId ||
                  updateListingMutation.isPending ||
                  !editingListing
                }
                data-testid="button-confirm-edit"
              >
                {updateListingMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Active Listings</CardTitle>
              <CardDescription>
                {listings.length} total listings
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-8">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No listings found</h3>
              <p className="text-sm text-muted-foreground">
                {listings.length === 0 
                  ? "Create your first listing to get started"
                  : "No listings match your current filters"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Photo</TableHead>
                  <TableHead>Listing ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Pre-Showing Qualification</TableHead>
                  <TableHead>Accept Bookings</TableHead>
                  <TableHead>Listing Sites</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing) => {
                  const unitDetails = getUnitDetails(listing.unitId);
                  const facebookStatus = getFacebookStatus(listing);
                  const unit = listing.unit;
                  const coverPhoto = unit?.coverPhoto;
                  
                  return (
                    <TableRow key={listing.id} data-testid={`row-listing-${listing.id}`}>
                      <TableCell>
                        {coverPhoto ? (
                          <img 
                            src={coverPhoto} 
                            alt={`Unit ${unit?.unitNumber || 'Unknown'}`}
                            className="w-12 h-12 object-cover rounded-md border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md border bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono" title={listing.id}>
                          {listing.id.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                        {getPropertyName(listing.propertyId)}
                          {isImportedFromFacebook(listing) && (
                            <Badge variant="secondary" className="text-xs">
                              <Facebook className="h-3 w-3 mr-1" />
                              Imported from Facebook
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        Unit {getUnitNumber(listing.unitId)}
                      </TableCell>
                      <TableCell>
                        {unitDetails && (
                          <span className="text-sm text-muted-foreground">
                            {unitDetails.bedrooms}BR/{unitDetails.bathrooms}BA - ${unitDetails.rent}/mo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={listing.preQualifyEnabled ?? false}
                            onCheckedChange={() => togglePreQualifyMutation.mutate({
                              id: listing.id,
                              preQualifyEnabled: listing.preQualifyEnabled ?? false,
                            })}
                            data-testid={`switch-prequalify-${listing.id}`}
                          />
                          {listing.preQualifyEnabled && (
                            <ClipboardCheck className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={listing.acceptBookings ?? true}
                          onCheckedChange={() => toggleAcceptBookingsMutation.mutate({
                            id: listing.id,
                            acceptBookings: listing.acceptBookings ?? true,
                          })}
                          data-testid={`switch-accept-bookings-${listing.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {facebookStatus === 'loading' && (
                            <div className="flex items-center gap-1.5 text-blue-600" title="Uploading to Facebook Marketplace...">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Uploading...</span>
                            </div>
                          )}
                          {facebookStatus === 'success' && (
                            <a
                              href={listing.facebookListingId ? `https://www.facebook.com/marketplace/item/${listing.facebookListingId}` : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                              title="View on Facebook Marketplace"
                            >
                              <svg className="h-4 w-4 fill-blue-600" viewBox="0 0 24 24" aria-label="Facebook">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              <span className="text-xs text-muted-foreground">Facebook</span>
                            </a>
                          )}
                          {facebookStatus === 'failed' && (
                            <div className="flex items-center gap-1.5 text-destructive" title="Facebook upload failed">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Facebook failed</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {listing.createdAt ? format(new Date(listing.createdAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant={listing.status === "active" ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleListingStatusMutation.mutate({
                              id: listing.id,
                              status: listing.status!,
                            })}
                            title={listing.status === "active" ? "Deactivate listing" : "Activate listing"}
                            data-testid={`button-toggle-status-${listing.id}`}
                            className={listing.status === "active" ? "bg-green-600 hover:bg-green-700 text-white" : "border-green-600 text-green-600 hover:bg-green-50"}
                          >
                            {listing.status === "active" ? "Listed" : "Not Listed"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(listing)}
                            title="Edit listing"
                            data-testid={`button-edit-${listing.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {listing.acceptBookings && unit?.bookingEnabled && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/book-showing/unit/${listing.unitId}`, "_blank")}
                              title="View public booking page"
                              data-testid={`button-view-booking-${listing.id}`}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteListingMutation.mutate(listing.id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete listing"
                            data-testid={`button-delete-${listing.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
