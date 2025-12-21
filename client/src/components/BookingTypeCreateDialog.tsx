import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Building2, Home } from "lucide-react";

interface BookingTypeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (propertyId: string, propertyName: string, selectedUnitIds: string[] | "all") => void;
}

export default function BookingTypeCreateDialog({ 
  open, 
  onOpenChange,
  onContinue 
}: BookingTypeCreateDialogProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [applyToAll, setApplyToAll] = useState(false);

  // Fetch properties with units (includeAll=true to show all properties)
  const { data: propertiesWithListedUnits = [], isLoading: propertiesLoading } = useQuery<Array<{
    id: string;
    name: string;
    address: string;
    bookingEnabled?: boolean;
    listedUnits: Array<{
      id: string;
      unitNumber: string;
      bedrooms: number;
      bathrooms: string;
      status: string;
      isListed: boolean;
      bookingEnabled: boolean;
      bookingTypeName?: string | null;
    }>;
  }>>({
    queryKey: ["/api/properties/with-listed-units?includeAll=true"],
  });

  const selectedProperty = propertiesWithListedUnits.find(p => p.id === selectedPropertyId);

  // Filter units: available units are those without a booking type
  const availableUnits = selectedProperty?.listedUnits.filter(unit => !unit.bookingTypeName) || [];
  const unavailableUnits = selectedProperty?.listedUnits.filter(unit => unit.bookingTypeName) || [];

  const handleToggleUnit = (unitId: string) => {
    // Don't allow toggling units that already have a booking type
    const unit = selectedProperty?.listedUnits.find(u => u.id === unitId);
    if (unit?.bookingTypeName) {
      return; // Unit already has a booking type, cannot be selected
    }
    
    setSelectedUnitIds(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
    // If manually selecting units, turn off "apply to all"
    if (applyToAll) {
      setApplyToAll(false);
    }
  };

  const handleToggleAll = (checked: boolean) => {
    setApplyToAll(checked);
    if (checked) {
      // Select only available units (those without booking types) when "apply to all" is checked
      setSelectedUnitIds(availableUnits.map(u => u.id));
    } else {
      // Clear all selected units when "apply to all" is unchecked
      setSelectedUnitIds([]);
    }
  };

  const handleContinue = () => {
    if (!selectedPropertyId || !selectedProperty) return;

    const unitSelection = applyToAll ? "all" : selectedUnitIds;
    onContinue(selectedPropertyId, selectedProperty.name, unitSelection);
    
    // Reset state
    setSelectedPropertyId("");
    setSelectedUnitIds([]);
    setApplyToAll(false);
  };

  const canContinue = selectedPropertyId && (applyToAll || selectedUnitIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-create-booking-type">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Booking Type
          </DialogTitle>
          <DialogDescription>
            Select a property and choose which units this booking type will apply to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Property Selection */}
          <div className="space-y-2">
            <Label htmlFor="property-select">Property</Label>
            {propertiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedPropertyId}
                onValueChange={(value) => {
                  setSelectedPropertyId(value);
                  setSelectedUnitIds([]);
                  setApplyToAll(false);
                }}
              >
                <SelectTrigger id="property-select" data-testid="select-property">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {propertiesWithListedUnits.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{property.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {property.address} • {property.listedUnits.length} {property.listedUnits.length === 1 ? 'unit' : 'units'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Unit Selection */}
          {selectedProperty && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Units</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="apply-all"
                    checked={applyToAll}
                    onCheckedChange={handleToggleAll}
                    data-testid="checkbox-apply-all"
                  />
                  <label
                    htmlFor="apply-all"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Apply to all units
                  </label>
                </div>
              </div>

              <Card>
                <ScrollArea className="h-[240px]">
                  <div className="p-4 space-y-2">
                    {/* Available units (no booking type) */}
                    {availableUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center gap-3 rounded-md border p-3 hover-elevate"
                        data-testid={`unit-option-${unit.id}`}
                      >
                        <Checkbox
                          id={`unit-${unit.id}`}
                          checked={selectedUnitIds.includes(unit.id) || applyToAll}
                          onCheckedChange={() => handleToggleUnit(unit.id)}
                          disabled={applyToAll}
                          data-testid={`checkbox-unit-${unit.id}`}
                        />
                        <label
                          htmlFor={`unit-${unit.id}`}
                          className="flex-1 flex items-center gap-2 cursor-pointer"
                        >
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {unit.bedrooms} bed • {unit.bathrooms} bath
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                    
                    {/* Unavailable units (already have booking type) */}
                    {unavailableUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center gap-3 rounded-md border p-3 bg-muted/50 opacity-60"
                        data-testid={`unit-option-unavailable-${unit.id}`}
                      >
                        <Checkbox
                          id={`unit-${unit.id}`}
                          checked={false}
                          disabled={true}
                          data-testid={`checkbox-unit-${unit.id}-disabled`}
                        />
                        <label
                          htmlFor={`unit-${unit.id}`}
                          className="flex-1 flex items-center gap-2 cursor-not-allowed"
                        >
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Unit {unit.unitNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {unit.bedrooms} bed • {unit.bathrooms} bath
                            </p>
                            <p className="text-xs text-muted-foreground italic mt-0.5">
                              Already has booking type: {unit.bookingTypeName}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                    
                    {/* Note about unavailable units */}
                    {unavailableUnits.length > 0 && (
                      <div className="mt-3 p-2 bg-muted/30 rounded-md border border-muted">
                        <p className="text-xs text-muted-foreground">
                          {unavailableUnits.length} {unavailableUnits.length === 1 ? 'unit is' : 'units are'} unavailable because {unavailableUnits.length === 1 ? 'it already has' : 'they already have'} a booking event type. Each unit can only have one booking type.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>

              {!applyToAll && selectedUnitIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedUnitIds.length} {selectedUnitIds.length === 1 ? 'unit' : 'units'} selected
                  {unavailableUnits.length > 0 && (
                    <span className="ml-2 text-xs">
                      ({unavailableUnits.length} {unavailableUnits.length === 1 ? 'unit' : 'units'} unavailable)
                    </span>
                  )}
                </p>
              )}
              {applyToAll && unavailableUnits.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {availableUnits.length} {availableUnits.length === 1 ? 'unit' : 'units'} will be selected
                  <span className="ml-2 text-xs">
                    ({unavailableUnits.length} {unavailableUnits.length === 1 ? 'unit' : 'units'} unavailable)
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            data-testid="button-continue"
          >
            Continue to Booking Event Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
