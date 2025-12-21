import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Link2, MoreVertical, Edit, Power, CalendarPlus, ExternalLink, Trash2, GripVertical, Home } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PropertySchedulingDialog from "@/components/PropertySchedulingDialog";
import UnitSchedulingDialog from "@/components/UnitSchedulingDialog";
import BookingTypeCreateDialog from "@/components/BookingTypeCreateDialog";
import { queryClient, apiRequest } from "@/lib/queryClient";

type PropertyWithUnits = {
  id: string;
  name: string;
  address: string;
  coverPhoto?: string | null;
  bookingEnabled?: boolean;
  displayOrder?: number | null;
  listedUnits: Array<{
    id: string;
    unitNumber: string;
    bedrooms: number;
    bathrooms: string;
    status: string;
    isListed: boolean;
    bookingEnabled: boolean;
    bookingTypeName?: string | null;
    bookingTypeMode?: string | null;
    bookingTypeEventDuration?: number | null;
    coverPhoto?: string | null;
    displayOrder?: number | null;
    createdFromListingId?: string | null;
  }>;
};

type UnitType = PropertyWithUnits['listedUnits'][0];

interface SortableUnitProps {
  unit: UnitType;
  propertyId: string;
  propertyName: string;
  propertyCoverPhoto?: string | null;
  onOpenUnitScheduling: (unitId: string, unitNumber: string, propertyId: string, propertyName: string) => void;
  onCopyBookingLink: (unitId: string, unitNumber: string, propertyName: string) => void;
  onToggleBooking: (unitId: string, bookingEnabled: boolean) => void;
  onDeleteUnit: (unitId: string, unitNumber: string) => void;
}

function SortableUnit({
  unit,
  propertyId,
  propertyName,
  propertyCoverPhoto,
  onOpenUnitScheduling,
  onCopyBookingLink,
  onToggleBooking,
  onDeleteUnit,
}: SortableUnitProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center justify-between gap-2 rounded-md border p-2 bg-muted/50"
        data-testid={`unit-${unit.id}`}
      >
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            data-drag-handle
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center justify-center flex-shrink-0"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div 
            className="flex-1 min-w-0 cursor-pointer hover-elevate rounded-sm p-1 -ml-1 flex items-center gap-3"
            onClick={() => {
              onOpenUnitScheduling(unit.id, unit.unitNumber, propertyId, propertyName);
            }}
          >
            <div className="flex-shrink-0">
              {unit.coverPhoto ? (
                <img 
                  src={unit.coverPhoto} 
                  alt={`${propertyName} - Unit ${unit.unitNumber}`}
                  className="w-12 h-12 object-cover rounded-md border"
                />
              ) : propertyCoverPhoto ? (
                <img 
                  src={propertyCoverPhoto} 
                  alt={`${propertyName} - Unit ${unit.unitNumber}`}
                  className="w-12 h-12 object-cover rounded-md border"
                />
              ) : (
                <div className="w-12 h-12 rounded-md border bg-muted flex items-center justify-center">
                  <Home className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
              <p className="text-xs text-muted-foreground">
                {unit.bedrooms} bed, {unit.bathrooms} bath
              </p>
              <div className="mt-1 space-y-1">
                {unit.bookingTypeName && (
                  <div>
                    <Badge variant="default" className="text-xs" data-testid={`badge-booking-type-${unit.id}`}>
                      {unit.bookingTypeName}
                    </Badge>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {unit.bookingTypeMode && (
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-booking-mode-${unit.id}`}>
                      {unit.bookingTypeMode === 'one_to_one' ? '1-to-1' : 'Group'}
                    </Badge>
                  )}
                  {unit.bookingTypeEventDuration && (
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-event-duration-${unit.id}`}>
                      {unit.bookingTypeEventDuration}min
                    </Badge>
                  )}
                  {!unit.bookingEnabled && (
                    <Badge variant="outline" className="text-xs">
                      Booking Disabled
                    </Badge>
                  )}
                  {unit.createdFromListingId && (
                    <Badge variant="outline" className="text-xs" data-testid={`badge-listing-${unit.id}`} title={`From Listing: ${unit.createdFromListingId}`}>
                      Listing: {unit.createdFromListingId.substring(0, 8)}...
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={unit.status === "occupied" ? "secondary" : "default"} className="text-xs">
            {unit.status === "occupied" ? "Occupied" : "Not Occupied"}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/book-showing/unit/${unit.id}`, '_blank');
            }}
            data-testid={`button-preview-booking-unit-${unit.id}`}
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCopyBookingLink(unit.id, unit.unitNumber, propertyName);
            }}
            data-testid={`button-copy-link-unit-${unit.id}`}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-unit-menu-${unit.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUnitScheduling(unit.id, unit.unitNumber, propertyId, propertyName);
                }}
                data-testid={`menu-edit-unit-${unit.id}`}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Booking Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBooking(unit.id, !unit.bookingEnabled);
                }}
                data-testid={`menu-toggle-unit-booking-${unit.id}`}
              >
                <Power className="h-4 w-4 mr-2" />
                {unit.bookingEnabled ? "Turn Off Booking" : "Turn On Booking"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteUnit(unit.id, unit.unitNumber);
                }}
                data-testid={`menu-delete-unit-${unit.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Booking Type
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface SortableUnitListProps {
  propertyId: string;
  units: UnitType[];
  propertyName: string;
  propertyCoverPhoto?: string | null;
  sensors: ReturnType<typeof useSensors>;
  activeUnitId: string | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent, propertyId: string) => void;
  onOpenUnitScheduling: (unitId: string, unitNumber: string, propertyId: string, propertyName: string) => void;
  onCopyBookingLink: (unitId: string, unitNumber: string, propertyName: string) => void;
  onToggleBooking: (unitId: string, bookingEnabled: boolean) => void;
  onDeleteUnit: (unitId: string, unitNumber: string) => void;
}

function SortableUnitList({
  propertyId,
  units,
  propertyName,
  propertyCoverPhoto,
  sensors,
  activeUnitId,
  onDragStart,
  onDragEnd,
  onOpenUnitScheduling,
  onCopyBookingLink,
  onToggleBooking,
  onDeleteUnit,
}: SortableUnitListProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={(event) => onDragEnd(event, propertyId)}
    >
      <SortableContext items={units.map(u => u.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Units:</p>
          {units.map((unit) => (
            <SortableUnit 
              key={unit.id} 
              unit={unit} 
              propertyId={propertyId} 
              propertyName={propertyName}
              propertyCoverPhoto={propertyCoverPhoto}
              onOpenUnitScheduling={onOpenUnitScheduling}
              onCopyBookingLink={onCopyBookingLink}
              onToggleBooking={onToggleBooking}
              onDeleteUnit={onDeleteUnit}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeUnitId ? (
          <div className="rounded-md border p-2 bg-background shadow-lg opacity-90">
            <p className="text-sm font-medium">Dragging unit...</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SortablePropertyProps {
  property: PropertyWithUnits;
  sensors: ReturnType<typeof useSensors>;
  activeUnitId: string | null;
  onOpenPropertyScheduling: (propertyId: string, propertyName: string) => void;
  onCopyPropertyBookingLink: (propertyId: string, propertyName: string) => void;
  onTogglePropertyBooking: (propertyId: string, bookingEnabled: boolean) => void;
  onDeleteProperty: (propertyId: string, propertyName: string) => void;
  onOpenUnitScheduling: (unitId: string, unitNumber: string, propertyId: string, propertyName: string) => void;
  onCopyBookingLink: (unitId: string, unitNumber: string, propertyName: string) => void;
  onToggleBooking: (unitId: string, bookingEnabled: boolean) => void;
  onDeleteUnit: (unitId: string, unitNumber: string) => void;
  onUnitDragStart: (event: DragStartEvent) => void;
  onUnitDragEnd: (event: DragEndEvent, propertyId: string) => void;
}

function SortableProperty({
  property,
  sensors,
  activeUnitId,
  onOpenPropertyScheduling,
  onCopyPropertyBookingLink,
  onTogglePropertyBooking,
  onDeleteProperty,
  onOpenUnitScheduling,
  onCopyBookingLink,
  onToggleBooking,
  onDeleteUnit,
  onUnitDragStart,
  onUnitDragEnd,
}: SortablePropertyProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const unitsWithBookingTypes = property.listedUnits.filter(unit => unit.bookingTypeName);

  return (
    <div ref={setNodeRef} style={style}>
      <AccordionItem value={property.id} className="border rounded-md px-3">
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              data-drag-handle
              className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center justify-center flex-shrink-0"
              style={{ touchAction: 'none' }}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div 
              className="flex-1 min-w-0 text-left cursor-pointer hover-elevate rounded-md p-2 -ml-2 flex items-center gap-3"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPropertyScheduling(property.id, property.name);
              }}
            >
              <div className="flex-shrink-0">
                {property.coverPhoto ? (
                  <img 
                    src={property.coverPhoto} 
                    alt={property.name}
                    className="w-16 h-16 object-cover rounded-md border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center">
                    <Home className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{property.name}</p>
                <p className="text-sm text-muted-foreground truncate">{property.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {unitsWithBookingTypes.length} {unitsWithBookingTypes.length === 1 ? 'unit' : 'units'}
                  </p>
                  {!property.bookingEnabled && (
                    <Badge variant="outline" className="text-xs">
                      Booking Disabled
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onCopyPropertyBookingLink(property.id, property.name)}
              data-testid={`button-copy-property-link-${property.id}`}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-property-menu-${property.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => window.open(`/book-showing/property/${property.id}`, '_blank')}
                  data-testid={`menu-preview-property-${property.id}`}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview Booking Page
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onTogglePropertyBooking(property.id, !property.bookingEnabled);
                  }}
                  data-testid={`menu-toggle-property-booking-${property.id}`}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {property.bookingEnabled ? "Turn Off Booking" : "Turn On Booking"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onOpenPropertyScheduling(property.id, property.name)}
                  data-testid={`menu-edit-property-${property.id}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Booking Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    onDeleteProperty(property.id, property.name);
                  }}
                  data-testid={`menu-delete-property-${property.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Booking Type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AccordionTrigger 
              className="hover:no-underline py-0" 
              data-testid={`property-${property.id}`}
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-drag-handle]')) {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-drag-handle]')) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
          </div>
        </div>
        <AccordionContent className="pb-3 pt-1">
          <SortableUnitList 
            propertyId={property.id} 
            units={unitsWithBookingTypes} 
            propertyName={property.name} 
            propertyCoverPhoto={property.coverPhoto}
            sensors={sensors}
            activeUnitId={activeUnitId}
            onDragStart={onUnitDragStart}
            onDragEnd={onUnitDragEnd}
            onOpenUnitScheduling={onOpenUnitScheduling}
            onCopyBookingLink={onCopyBookingLink}
            onToggleBooking={onToggleBooking}
            onDeleteUnit={onDeleteUnit}
          />
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}

export default function Scheduling() {
  const { toast } = useToast();
  const [isPropertySchedulingOpen, setIsPropertySchedulingOpen] = useState(false);
  const [schedulingPropertyId, setSchedulingPropertyId] = useState<string | null>(null);
  const [schedulingPropertyName, setSchedulingPropertyName] = useState<string>("");
  
  const [isUnitSchedulingOpen, setIsUnitSchedulingOpen] = useState(false);
  const [unitSchedulingUnitId, setUnitSchedulingUnitId] = useState<string | null>(null);
  const [unitSchedulingUnitNumber, setUnitSchedulingUnitNumber] = useState<string>("");
  const [unitSchedulingPropertyId, setUnitSchedulingPropertyId] = useState<string | null>(null);
  const [unitSchedulingPropertyName, setUnitSchedulingPropertyName] = useState<string>("");
  
  const [isBookingTypeCreateOpen, setIsBookingTypeCreateOpen] = useState(false);
  const [selectedUnitsForCreation, setSelectedUnitsForCreation] = useState<string[] | "all" | null>(null);
  const [isCreationFlow, setIsCreationFlow] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'property' | 'unit';
    id: string;
    name: string;
  } | null>(null);

  const [listingConfirmation, setListingConfirmation] = useState<{
    unitId: string;
    listingId: string;
      bookingEnabled: boolean;
    isDeleting?: boolean; // Flag to indicate if this is for deletion/disable
  } | null>(null);

  const { data: propertiesWithListedUnits = [] } = useQuery<PropertyWithUnits[]>({
    queryKey: ["/api/properties/with-listed-units"],
  });

  const handleCopyPropertyBookingLink = useCallback((propertyId: string, propertyName: string) => {
    const bookingUrl = `${window.location.origin}/book-showing/property/${propertyId}`;
    navigator.clipboard.writeText(bookingUrl).then(() => {
      toast({
        title: "Link copied!",
        description: `Public booking page link for ${propertyName} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy booking link to clipboard",
      });
    });
  }, [toast]);

  const handleCopyBookingLink = useCallback((unitId: string, unitNumber: string, propertyName: string) => {
    const bookingUrl = `${window.location.origin}/book-showing/unit/${unitId}`;
    navigator.clipboard.writeText(bookingUrl).then(() => {
      toast({
        title: "Link copied!",
        description: `Booking link for ${propertyName} - Unit ${unitNumber} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy booking link to clipboard",
      });
    });
  }, [toast]);

  const handleOpenPropertyScheduling = useCallback((propertyId: string, propertyName: string) => {
    setSchedulingPropertyId(propertyId);
    setSchedulingPropertyName(propertyName);
    setIsCreationFlow(false);
    setSelectedUnitsForCreation(null);
    setIsPropertySchedulingOpen(true);
  }, []);

  const handleOpenUnitScheduling = useCallback((unitId: string, unitNumber: string, propertyId: string, propertyName: string) => {
    setUnitSchedulingUnitId(unitId);
    setUnitSchedulingUnitNumber(unitNumber);
    setUnitSchedulingPropertyId(propertyId);
    setUnitSchedulingPropertyName(propertyName);
    setIsUnitSchedulingOpen(true);
  }, []);

  const handleBookingTypeCreationContinue = useCallback((propertyId: string, propertyName: string, selectedUnitIds: string[] | "all") => {
    setSchedulingPropertyId(propertyId);
    setSchedulingPropertyName(propertyName);
    setSelectedUnitsForCreation(selectedUnitIds);
    setIsCreationFlow(true);
    setIsBookingTypeCreateOpen(false);
    setIsPropertySchedulingOpen(true);
  }, []);

  const toggleBookingMutation = useMutation({
    mutationFn: async ({ unitId, bookingEnabled, turnOnListing }: { unitId: string; bookingEnabled: boolean; turnOnListing?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/units/${unitId}/scheduling`, { bookingEnabled, turnOnListing });
      const data = await response.json();
      return data;
    },
    onSuccess: (data, variables) => {
      // Check if server requires listing confirmation
      if (data.requiresListingConfirmation) {
        setListingConfirmation({
          unitId: variables.unitId,
          listingId: data.listingId,
          bookingEnabled: variables.bookingEnabled,
          isDeleting: false,
        });
        return; // Don't invalidate or show toast yet
      }
      
      // Check if server requires listing deactivation confirmation
      if (data.requiresListingDeactivationConfirmation) {
        setListingConfirmation({
          unitId: variables.unitId,
          listingId: data.listingId,
          bookingEnabled: false,
          isDeleting: true,
        });
        return; // Don't invalidate or show toast yet
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units", variables.unitId, "scheduling"] });
      toast({
        title: variables.bookingEnabled ? "Booking enabled" : "Booking disabled",
        description: variables.bookingEnabled 
          ? "This unit can now accept bookings" 
          : "This unit is listed but booking is disabled",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to toggle booking status",
      });
    },
  });

  const togglePropertyBookingMutation = useMutation({
    mutationFn: async ({ propertyId, bookingEnabled }: { propertyId: string; bookingEnabled: boolean }) => {
      return await apiRequest("PATCH", `/api/properties/${propertyId}/booking-toggle`, { bookingEnabled });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", variables.propertyId, "scheduling-settings"] });
      toast({
        title: variables.bookingEnabled ? "Property booking enabled" : "Property booking disabled",
        description: variables.bookingEnabled 
          ? "Property and all unit bookings are now enabled" 
          : "Property and all unit bookings are now disabled.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to toggle property booking status",
      });
    },
  });

  const updatePropertyOrdersMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; displayOrder: number }>) => {
      return await apiRequest("PATCH", `/api/properties/display-orders`, { orders: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update property order",
      });
    },
  });

  const updateUnitOrdersMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; displayOrder: number }>) => {
      console.log("[Scheduling] Sending unit order update:", updates);
      const response = await apiRequest("PATCH", `/api/units/display-orders`, { orders: updates });
      const data = await response.json();
      console.log("[Scheduling] Unit order update response:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      toast({
        title: "Success",
        description: "Unit order updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("[Scheduling] Unit order update error:", error);
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update unit order",
      });
    },
  });

  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handlePropertyDragStart = useCallback((event: DragStartEvent) => {
    console.log("[Scheduling] Property drag start:", event.active.id);
    setActivePropertyId(String(event.active.id));
  }, []);

  const handlePropertyDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActivePropertyId(null);

    if (!over) {
      console.log("[Scheduling] Property drag ended with no over target");
      return;
    }

    const targetId = String(over.id);
    const activeId = String(active.id);

    console.log("[Scheduling] Property drag end:", { activeId, targetId });

    if (activeId === targetId) {
      console.log("[Scheduling] Property drag ended on same item, ignoring");
      return;
    }

    const properties = propertiesWithListedUnits.filter(property => 
      property.listedUnits.some(unit => unit.bookingTypeName)
    );
    
    const oldIndex = properties.findIndex(p => p.id === activeId);
    const newIndex = properties.findIndex(p => p.id === targetId);

    console.log("[Scheduling] Property drag indices:", { oldIndex, newIndex });

    if (oldIndex === -1 || newIndex === -1) {
      console.error("[Scheduling] Could not find property indices");
      return;
    }

    const reordered = arrayMove(properties, oldIndex, newIndex);
    const updates = reordered.map((property, index) => ({
      id: property.id,
      displayOrder: index
    }));

    queryClient.setQueryData<PropertyWithUnits[]>(
      ["/api/properties/with-listed-units"],
      (current) => {
        if (!current) return current;
        
        const propertiesWithBooking = current.filter(property => 
          property.listedUnits.some(unit => unit.bookingTypeName)
        );
        
        const reorderedProperties = arrayMove(propertiesWithBooking, oldIndex, newIndex);
        const orderMap = new Map(updates.map(u => [u.id, u.displayOrder]));
        
        const updatedReordered = reorderedProperties.map((property) => ({
          ...property,
          displayOrder: orderMap.get(property.id) ?? property.displayOrder
        }));
        
        const propertiesWithoutBooking = current.filter(property => 
          !property.listedUnits.some(unit => unit.bookingTypeName)
        );
        
        return [...updatedReordered, ...propertiesWithoutBooking].sort((a, b) => {
          const orderA = a.displayOrder ?? 0;
          const orderB = b.displayOrder ?? 0;
          if (orderA === orderB) {
            return a.name.localeCompare(b.name);
          }
          return orderA - orderB;
        });
      }
    );
    
    console.log("[Scheduling] Property reorder updates", updates);
    updatePropertyOrdersMutation.mutate(updates);
  }, [propertiesWithListedUnits, updatePropertyOrdersMutation]);

  const handleUnitDragStart = useCallback((event: DragStartEvent) => {
    console.log("[Scheduling] Unit drag start:", event.active.id);
    setActiveUnitId(String(event.active.id));
  }, []);

  const handleUnitDragEnd = useCallback((event: DragEndEvent, propertyId: string) => {
    const { active, over } = event;
    setActiveUnitId(null);

    if (!over) {
      console.log("[Scheduling] Unit drag ended with no over target");
      return;
    }

    const targetId = String(over.id);
    const activeId = String(active.id);

    console.log("[Scheduling] Unit drag end:", { activeId, targetId, propertyId });

    if (activeId === targetId) {
      console.log("[Scheduling] Unit drag ended on same item, ignoring");
      return;
    }

    const property = propertiesWithListedUnits.find(p => p.id === propertyId);
    if (!property) {
      console.error("[Scheduling] Property not found:", propertyId);
      return;
    }

    const units = property.listedUnits.filter(unit => unit.bookingTypeName);
    const oldIndex = units.findIndex(u => u.id === activeId);
    const newIndex = units.findIndex(u => u.id === targetId);

    console.log("[Scheduling] Unit drag indices:", { oldIndex, newIndex });

    if (oldIndex === -1 || newIndex === -1) {
      console.error("[Scheduling] Could not find unit indices");
      return;
    }

    const reordered = arrayMove(units, oldIndex, newIndex);
    const updates = reordered.map((unit, index) => ({
      id: unit.id,
      displayOrder: index
    }));

    queryClient.setQueryData<PropertyWithUnits[]>(
      ["/api/properties/with-listed-units"],
      (current) => {
        if (!current) return current;
        
        return current.map((prop) => {
          if (prop.id !== propertyId) {
            return prop;
          }
          
          const unitsWithBooking = prop.listedUnits.filter(unit => unit.bookingTypeName);
          const reorderedUnits = arrayMove(unitsWithBooking, oldIndex, newIndex);
          const orderMap = new Map(updates.map(u => [u.id, u.displayOrder]));
          
          const updatedReordered = reorderedUnits.map((unit) => ({
            ...unit,
            displayOrder: orderMap.get(unit.id) ?? unit.displayOrder
          }));
          
          const unitsWithoutBooking = prop.listedUnits.filter(unit => !unit.bookingTypeName);
          
          const allUnits = [...updatedReordered, ...unitsWithoutBooking].sort((a, b) => {
            const orderA = a.displayOrder ?? 0;
            const orderB = b.displayOrder ?? 0;
            if (orderA === orderB) {
              return a.unitNumber.localeCompare(b.unitNumber);
            }
            return orderA - orderB;
          });
          
          return { ...prop, listedUnits: allUnits };
        });
      }
    );
    
    console.log("[Scheduling] Unit reorder updates", { propertyId, updates });
    updateUnitOrdersMutation.mutate(updates);
  }, [propertiesWithListedUnits, updateUnitOrdersMutation]);

  const deletePropertySchedulingMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return await apiRequest("DELETE", `/api/properties/${propertyId}/scheduling-settings`);
    },
    onSuccess: (_, propertyId) => {
      // Invalidate all variants of the properties query, including the one with includeAll=true
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "scheduling-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      toast({
        title: "Booking type deleted",
        description: "Property-level scheduling settings have been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete property scheduling settings",
      });
    },
  });

  const deleteUnitSchedulingMutation = useMutation({
    mutationFn: async ({ unitId, deactivateListing }: { unitId: string; deactivateListing?: boolean }) => {
      const url = `/api/units/${unitId}/scheduling${deactivateListing ? '?deactivateListing=true' : ''}`;
      const response = await apiRequest("DELETE", url);
      // Handle 204 No Content response
      if (response.status === 204) {
        return { deleted: true };
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      // Check if server requires listing deactivation confirmation
      if (data.requiresListingDeactivationConfirmation) {
        setListingConfirmation({
          unitId: variables.unitId,
          listingId: data.listingId,
          bookingEnabled: false, // We're disabling/deleting
          isDeleting: true,
        });
        return; // Don't invalidate or show toast yet
      }
      
      // Invalidate all variants of the properties query, including the one with includeAll=true
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units?includeAll=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units", variables.unitId, "scheduling"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      
      toast({
        title: data.disabled ? "Booking type disabled" : "Booking type deleted",
        description: data.disabled 
          ? "Booking type has been disabled and listing deactivated. The unit is now available for creating a new booking type."
          : "Unit scheduling settings have been removed. The unit is now available for creating a new booking type.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete unit scheduling settings",
      });
    },
  });

  const handleToggleBooking = useCallback((unitId: string, bookingEnabled: boolean) => {
    toggleBookingMutation.mutate({ unitId, bookingEnabled });
  }, [toggleBookingMutation]);

  const handleTogglePropertyBooking = useCallback((propertyId: string, bookingEnabled: boolean) => {
    togglePropertyBookingMutation.mutate({ propertyId, bookingEnabled });
  }, [togglePropertyBookingMutation]);

  const handleDeleteProperty = useCallback((propertyId: string, propertyName: string) => {
    setDeleteConfirmation({
      type: 'property',
      id: propertyId,
      name: propertyName
    });
  }, []);

  const handleDeleteUnit = useCallback((unitId: string, unitNumber: string) => {
    // Show confirmation dialog first
    setDeleteConfirmation({
      type: 'unit',
      id: unitId,
      name: `Unit ${unitNumber}`
    });
  }, []);

  const propertiesWithBookingTypes = propertiesWithListedUnits.filter(property => 
    property.listedUnits.some(unit => unit.bookingTypeName)
  );

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Property Scheduling</h1>
            <p className="text-muted-foreground">
              Configure scheduling settings and booking links for properties with units
            </p>
          </div>
          <Button 
            onClick={() => setIsBookingTypeCreateOpen(true)}
            data-testid="button-create-booking-type"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Create Booking Type
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Property Booking Settings</CardTitle>
            <CardDescription>Configure scheduling settings for properties with units</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {propertiesWithBookingTypes.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm">
                    No booking types found. Click "Create Booking Type" to configure booking settings for your properties.
                  </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handlePropertyDragStart}
                onDragEnd={handlePropertyDragEnd}
              >
                <SortableContext items={propertiesWithBookingTypes.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <Accordion type="multiple" className="space-y-2">
                    {propertiesWithBookingTypes.map((property) => (
                      <SortableProperty 
                        key={property.id} 
                        property={property}
                        sensors={sensors}
                        activeUnitId={activeUnitId}
                        onOpenPropertyScheduling={handleOpenPropertyScheduling}
                        onCopyPropertyBookingLink={handleCopyPropertyBookingLink}
                        onTogglePropertyBooking={handleTogglePropertyBooking}
                        onDeleteProperty={handleDeleteProperty}
                        onOpenUnitScheduling={handleOpenUnitScheduling}
                        onCopyBookingLink={handleCopyBookingLink}
                        onToggleBooking={handleToggleBooking}
                        onDeleteUnit={handleDeleteUnit}
                        onUnitDragStart={handleUnitDragStart}
                        onUnitDragEnd={handleUnitDragEnd}
                      />
                    ))}
                </Accordion>
                </SortableContext>
                <DragOverlay>
                  {activePropertyId ? (
                    <div className="border rounded-md px-3 py-3 bg-background shadow-lg opacity-90">
                      <p className="font-medium">Dragging property...</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      <BookingTypeCreateDialog
        open={isBookingTypeCreateOpen}
        onOpenChange={(open) => {
          setIsBookingTypeCreateOpen(open);
          if (!open) {
            setSelectedUnitsForCreation(null);
            setIsCreationFlow(false);
          }
        }}
        onContinue={handleBookingTypeCreationContinue}
      />

      {schedulingPropertyId && (
        <PropertySchedulingDialog
          isOpen={isPropertySchedulingOpen}
          onClose={() => {
            setIsPropertySchedulingOpen(false);
            setSelectedUnitsForCreation(null);
            setIsCreationFlow(false);
          }}
          propertyId={schedulingPropertyId}
          propertyName={schedulingPropertyName}
          selectedUnitIds={selectedUnitsForCreation}
          isCreationFlow={isCreationFlow}
        />
      )}

      {unitSchedulingUnitId && unitSchedulingPropertyId && (
        <UnitSchedulingDialog
          isOpen={isUnitSchedulingOpen}
          onClose={() => setIsUnitSchedulingOpen(false)}
          unitId={unitSchedulingUnitId}
          unitNumber={unitSchedulingUnitNumber}
          propertyId={unitSchedulingPropertyId}
          propertyName={unitSchedulingPropertyName}
        />
      )}

      <AlertDialog open={deleteConfirmation !== null} onOpenChange={() => setDeleteConfirmation(null)}>
        <AlertDialogContent data-testid="alert-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking Type</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation?.type === 'property' 
                ? `Are you sure you want to delete the booking type for ${deleteConfirmation.name}? This will remove all property-level scheduling settings.`
                : `Are you sure you want to delete the booking type for ${deleteConfirmation?.name}? This unit will revert to using property-level scheduling settings.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmation) {
                  if (deleteConfirmation.type === 'property') {
                  deletePropertySchedulingMutation.mutate(deleteConfirmation.id);
                  } else if (deleteConfirmation.type === 'unit') {
                    deleteUnitSchedulingMutation.mutate({ unitId: deleteConfirmation.id });
                }
                setDeleteConfirmation(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Listing Confirmation Dialog */}
      <AlertDialog open={!!listingConfirmation} onOpenChange={(open) => !open && setListingConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {listingConfirmation?.isDeleting 
                ? "Deactivate Listing?" 
                : "Turn On Listing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {listingConfirmation?.isDeleting
                ? "This booking type is linked to a listing. Disabling it will also deactivate the listing. Would you like to proceed?"
                : "Turning on this booking will also activate the listing. Would you like to proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (listingConfirmation) {
                  if (listingConfirmation.isDeleting) {
                    // Disable booking and deactivate listing
                    deleteUnitSchedulingMutation.mutate({ 
                      unitId: listingConfirmation.unitId,
                      deactivateListing: true 
                    });
                  } else {
                    // Turn on booking and listing
                    toggleBookingMutation.mutate({
                      unitId: listingConfirmation.unitId,
                      bookingEnabled: listingConfirmation.bookingEnabled,
                      turnOnListing: true,
                    });
                  }
                  setListingConfirmation(null);
                }
              }}
            >
              {listingConfirmation?.isDeleting 
                ? "Deactivate Listing & Disable Booking" 
                : "Turn On Listing & Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
