import { useState } from "react";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, ArrowLeft, Edit, Home, Trash2, MoreVertical } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import PropertyDetailView from "@/components/PropertyDetailView";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Property Actions Menu Component (3-dot menu)
function PropertyActionsMenu({ property, onEdit, onDeleted }: { property: any; onEdit: () => void; onDeleted: () => void }) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (propertyId: string) => apiRequest("DELETE", `/api/properties/${propertyId}`),
    onSuccess: (_, deletedPropertyId) => {
      // Invalidate all property-related queries to ensure UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      // Also invalidate any property-specific queries
      queryClient.invalidateQueries({ queryKey: ["/api/properties", deletedPropertyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", deletedPropertyId, "units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", deletedPropertyId, "scheduling-settings"] });
      
      toast({
        title: "Property deleted",
        description: "The property has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      onDeleted();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(property.id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            data-testid="button-property-actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit} data-testid="button-edit-property">
            <Edit className="h-4 w-4 mr-2" />
            Edit Property
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDelete} 
            className="text-destructive focus:text-destructive"
            data-testid="button-delete-property"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Property
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{property.name}"? This action cannot be undone and will delete all associated units and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-property">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-property"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Properties() {
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/properties/:id");
  
  // Use route parameter if available, otherwise use state
  const viewingPropertyId = match ? params?.id : null;
  const viewingProperty = viewingPropertyId ? properties.find(p => p.id === viewingPropertyId) : null;

  const handleEditProperty = (property: any) => {
    setLocation(`/properties/${property.id}/edit`);
  };

  const handlePropertyClick = (property: any) => {
    setLocation(`/properties/${property.id}`);
  };

  const handleBackToList = () => {
    setLocation("/properties");
  };

  // Show detail view if a property is selected via route
  if (viewingPropertyId && viewingProperty) {
    return (
      <div className="space-y-6">
        {/* Property Header with Cover Photo and Details */}
        <div className="flex items-start gap-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToList}
            data-testid="button-back-to-portfolio"
            className="mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Cover Photo */}
          <div className="flex-shrink-0">
            {viewingProperty.coverPhoto ? (
              <img
                src={viewingProperty.coverPhoto}
                alt={viewingProperty.name}
                className="w-32 h-32 object-cover rounded-lg border shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg border bg-muted flex items-center justify-center">
                <Home className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Property Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-semibold mb-1">{viewingProperty.name}</h1>
                <p className="text-muted-foreground">{viewingProperty.address}</p>
              </div>
              
              {/* 3-Dot Menu */}
              <PropertyActionsMenu 
                property={viewingProperty} 
                onEdit={() => handleEditProperty(viewingProperty)}
                onDeleted={handleBackToList}
              />
            </div>
          </div>
        </div>

        <PropertyDetailView 
          property={viewingProperty}
          onEdit={() => handleEditProperty(viewingProperty)}
        />
      </div>
    );
  }

  // Show list view
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Portfolio</h1>
          <p className="text-muted-foreground mt-1">Manage your property portfolio</p>
        </div>
        <Button 
          data-testid="button-add-property"
          onClick={() => setLocation("/properties/new")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search properties..."
          className="pl-9"
          data-testid="input-search-properties"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            name={property.name}
            address={property.address}
            units={property.units}
            activeLeads={property.activeLeads}
            conversionRate={property.conversionRate}
            coverPhoto={property.coverPhoto}
            onClick={() => handlePropertyClick(property)}
            onEdit={() => handleEditProperty(property)}
          />
        ))}
      </div>
    </div>
  );
}
