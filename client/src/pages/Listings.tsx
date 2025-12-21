import { useState } from "react";
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
import { Plus, Search, Trash2, Home, ClipboardCheck, ExternalLink, Settings } from "lucide-react";
import type { Listing, Property, PropertyUnit } from "@shared/schema";

type ListingWithDetails = Listing & {
  property?: Property;
  unit?: PropertyUnit;
};

export default function Listings() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [preQualifyEnabled, setPreQualifyEnabled] = useState(false);
  const [acceptBookings, setAcceptBookings] = useState(true);

  const { data: listings = [], isLoading: listingsLoading } = useQuery<ListingWithDetails[]>({
    queryKey: ["/api/listings"],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch units for the selected property (only when a property is selected)
  // Uses standard query client fetcher that handles errors and auth properly
  const { data: propertyUnits = [], isError: unitsError, isLoading: unitsLoading } = useQuery<PropertyUnit[]>({
    queryKey: ["/api/properties", selectedPropertyId, "units"],
    enabled: !!selectedPropertyId,
  });
  
  
  const createListingMutation = useMutation({
    mutationFn: async (data: { propertyId: string; unitId: string; preQualifyEnabled: boolean; acceptBookings: boolean }) => {
      const res = await apiRequest("POST", "/api/listings", {
        propertyId: data.propertyId,
        unitId: data.unitId,
        status: "active",
        preQualifyEnabled: data.preQualifyEnabled,
        acceptBookings: data.acceptBookings,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Listing created",
        description: "The unit listing has been created successfully.",
      });
    },
    onError: (error: any) => {
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

  const resetForm = () => {
    setSelectedPropertyId("");
    setSelectedUnitId("");
    setPreQualifyEnabled(false);
    setAcceptBookings(true);
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
    });
  };

  // Get unit IDs that are already listed
  const listedUnitIds = new Set(listings.map(l => l.unitId));
  
  // Filter units: must not already be listed
  const filteredUnits = propertyUnits.filter(u => !listedUnitIds.has(u.id));

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Listings</h1>
          <p className="text-muted-foreground">
            Manage your active unit listings and pre-qualification settings
          </p>
        </div>
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
                  <TableHead>Listing ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Pre-Qualify</TableHead>
                  <TableHead>Accept Bookings</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing) => {
                  const unitDetails = getUnitDetails(listing.unitId);
                  return (
                    <TableRow key={listing.id} data-testid={`row-listing-${listing.id}`}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono" title={listing.id}>
                          {listing.id.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getPropertyName(listing.propertyId)}
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
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/book-showing/unit/${listing.unitId}`, "_blank")}
                            title="View public booking page"
                            data-testid={`button-view-booking-${listing.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
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
