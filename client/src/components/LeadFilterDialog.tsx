import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeadFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadFilters;
  onApplyFilters: (filters: LeadFilters) => void;
}

export interface LeadFilters {
  statuses: string[];
  sources: string[];
  propertyIds: string[];
  aiHandled: "all" | "true" | "false";
}

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "prequalified", label: "Pre-qualified" },
  { value: "application", label: "Application" },
  { value: "approved", label: "Approved" },
];

const sourceOptions = [
  { value: "email", label: "Email" },
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook" },
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
  { value: "listing", label: "Listing" },
  { value: "manual", label: "Manual" },
];

export default function LeadFilterDialog({ 
  open, 
  onOpenChange, 
  filters, 
  onApplyFilters 
}: LeadFilterDialogProps) {
  // Fetch properties for the property filter
  const { data: properties = [] } = useQuery({
    queryKey: ["/api/properties"],
  });

  // Local state for filter selections
  const [localFilters, setLocalFilters] = useState<LeadFilters>(filters);

  // Sync local filters with props when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleStatusToggle = (status: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      statuses: checked
        ? [...prev.statuses, status]
        : prev.statuses.filter(s => s !== status)
    }));
  };

  const handleSourceToggle = (source: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      sources: checked
        ? [...prev.sources, source]
        : prev.sources.filter(s => s !== source)
    }));
  };

  const handlePropertyToggle = (propertyId: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      propertyIds: checked
        ? [...prev.propertyIds, propertyId]
        : prev.propertyIds.filter(id => id !== propertyId)
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: LeadFilters = {
      statuses: [],
      sources: [],
      propertyIds: [],
      aiHandled: "all",
    };
    setLocalFilters(clearedFilters);
    onApplyFilters(clearedFilters);
    onOpenChange(false);
  };

  const hasActiveFilters = 
    localFilters.statuses.length > 0 ||
    localFilters.sources.length > 0 ||
    localFilters.propertyIds.length > 0 ||
    localFilters.aiHandled !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-filter-leads">
        <DialogHeader>
          <DialogTitle>Filter Leads</DialogTitle>
          <DialogDescription>
            Select criteria to filter your leads. Leave all unchecked to show all leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Status</Label>
            <div className="space-y-2">
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={localFilters.statuses.includes(option.value)}
                    onCheckedChange={(checked) => handleStatusToggle(option.value, checked as boolean)}
                    data-testid={`checkbox-status-${option.value}`}
                  />
                  <Label
                    htmlFor={`status-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Source</Label>
            <div className="space-y-2">
              {sourceOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`source-${option.value}`}
                    checked={localFilters.sources.includes(option.value)}
                    onCheckedChange={(checked) => handleSourceToggle(option.value, checked as boolean)}
                    data-testid={`checkbox-source-${option.value}`}
                  />
                  <Label
                    htmlFor={`source-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Property Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Property</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties available</p>
              ) : (
                properties.map((property) => (
                  <div key={property.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`property-${property.id}`}
                      checked={localFilters.propertyIds.includes(property.id)}
                      onCheckedChange={(checked) => handlePropertyToggle(property.id, checked as boolean)}
                      data-testid={`checkbox-property-${property.id}`}
                    />
                    <Label
                      htmlFor={`property-${property.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {property.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Handled Filter */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">AI Handled</Label>
            <Select
              value={localFilters.aiHandled}
              onValueChange={(value) => setLocalFilters(prev => ({ ...prev, aiHandled: value as "all" | "true" | "false" }))}
            >
              <SelectTrigger data-testid="select-ai-handled">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">AI Handled</SelectItem>
                <SelectItem value="false">Not AI Handled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            data-testid="button-clear-filters"
          >
            Clear All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-filters"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            data-testid="button-apply-filters"
          >
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

