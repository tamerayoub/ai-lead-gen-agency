import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Properties() {
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Properties</h1>
          <p className="text-muted-foreground mt-1">Manage your property portfolio</p>
        </div>
        <Button data-testid="button-add-property">
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
            occupancy={property.occupancy}
            monthlyRevenue={property.monthlyRevenue}
            activeLeads={property.activeLeads}
            conversionRate={property.conversionRate}
            onClick={() => console.log(`Clicked ${property.name}`)}
          />
        ))}
      </div>
    </div>
  );
}
