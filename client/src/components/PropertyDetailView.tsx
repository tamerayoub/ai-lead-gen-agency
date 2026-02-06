import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Home, Image as ImageIcon, Pencil, FileText } from "lucide-react";
import { Listing, PropertyUnit } from "@shared/schema";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface PropertyDetailViewProps {
  property: any;
  onEdit: () => void;
}

export default function PropertyDetailView({ property, onEdit }: PropertyDetailViewProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<PropertyUnit | null>(null);

  const { data: units = [], isLoading } = useQuery<PropertyUnit[]>({
    queryKey: ["/api/properties", property.id, "units"],
    queryFn: () => fetch(`/api/properties/${property.id}/units`).then(res => res.json()),
  });

  const { data: propertyListings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/properties", property.id, "listings"],
    queryFn: () => fetch(`/api/properties/${property.id}/listings`).then((res) => res.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (unitId: string) => apiRequest("DELETE", `/api/units/${unitId}`),
    onSuccess: (_, deletedUnitId) => {
      // Invalidate all unit-related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/properties", property.id, "units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] }); // Scheduling page
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] }); // Properties list
      queryClient.invalidateQueries({ queryKey: ["/api/units", deletedUnitId] }); // Unit-specific
      queryClient.invalidateQueries({ queryKey: ["/api/units", deletedUnitId, "scheduling"] }); // Unit scheduling
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] }); // Scheduling settings
      
      toast({
        title: "Unit deleted",
        description: "The unit has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setUnitToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete unit. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddUnit = () => {
    setLocation(`/properties/${property.id}/units/new`);
  };

  const handleEditUnit = (unit: PropertyUnit) => {
    setLocation(`/units/${unit.id}/edit`);
  };

  const handleDeleteUnit = (unit: PropertyUnit) => {
    setUnitToDelete(unit);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (unitToDelete) {
      deleteMutation.mutate(unitToDelete.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      not_occupied: "default",
      occupied: "secondary",
    };
    
    const labels: Record<string, string> = {
      not_occupied: "Not Occupied",
      occupied: "Occupied",
    };
    
    return (
      <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-units">
              {property.units}
            </div>
            <p className="text-xs text-muted-foreground">
              {units.length} configured
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Units</CardTitle>
              <CardDescription>Manage individual units within this property</CardDescription>
            </div>
            <Button onClick={handleAddUnit} data-testid="button-add-unit">
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading units...</div>
          ) : units.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No units configured yet</p>
              <Button onClick={handleAddUnit} variant="outline" data-testid="button-add-first-unit">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Unit
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Photo</TableHead>
                  <TableHead>Unit #</TableHead>
                  <TableHead>Bedrooms</TableHead>
                  <TableHead>Bathrooms</TableHead>
                  <TableHead>Sq Ft</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Listed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id} data-testid={`row-unit-${unit.id}`}>
                    <TableCell>
                      {unit.coverPhoto ? (
                        <img 
                          src={unit.coverPhoto} 
                          alt={`Unit ${unit.unitNumber}`}
                          className="w-12 h-12 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md border bg-muted flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-unit-number-${unit.id}`}>
                      {unit.unitNumber}
                    </TableCell>
                    <TableCell>{unit.bedrooms}</TableCell>
                    <TableCell>{unit.bathrooms}</TableCell>
                    <TableCell>{unit.squareFeet ? unit.squareFeet.toLocaleString() : '-'}</TableCell>
                    <TableCell>{unit.monthlyRent ? `$${unit.monthlyRent}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(unit.status)}</TableCell>
                    <TableCell>
                      {unit.isListed ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {propertyListings.find((listing) => listing.unitId === unit.id) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const listing = propertyListings.find((l) => l.unitId === unit.id);
                              if (listing) {
                                setLocation(`/leasing/listings?edit=${listing.id}`);
                              }
                            }}
                            data-testid={`button-edit-listing-${unit.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit Listing
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocation(`/leasing/listings?create=true&propertyId=${property.id}&unitId=${unit.id}`);
                            }}
                            data-testid={`button-create-listing-${unit.id}`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Create Listing
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditUnit(unit)}
                          data-testid={`button-edit-unit-${unit.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUnit(unit)}
                          data-testid={`button-delete-unit-${unit.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete unit {unitToDelete?.unitNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
