import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";

export default function Properties() {
  const properties = [
    {
      name: "Sunset Apartments",
      address: "123 West Ave, Austin, TX",
      units: 24,
      occupancy: 92,
      monthlyRevenue: "$48,000",
      activeLeads: 12,
      conversionRate: "38%",
    },
    {
      name: "Downtown Lofts",
      address: "456 Main St, Austin, TX",
      units: 18,
      occupancy: 88,
      monthlyRevenue: "$36,000",
      activeLeads: 8,
      conversionRate: "42%",
    },
    {
      name: "Garden View Estates",
      address: "789 Garden Rd, Austin, TX",
      units: 32,
      occupancy: 95,
      monthlyRevenue: "$64,000",
      activeLeads: 15,
      conversionRate: "45%",
    },
    {
      name: "Riverside Complex",
      address: "321 River St, Austin, TX",
      units: 20,
      occupancy: 90,
      monthlyRevenue: "$40,000",
      activeLeads: 10,
      conversionRate: "36%",
    },
  ];

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
            key={property.name}
            {...property}
            onClick={() => console.log(`Clicked ${property.name}`)}
          />
        ))}
      </div>
    </div>
  );
}
