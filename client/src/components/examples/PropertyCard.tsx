import { PropertyCard } from "../PropertyCard";

export default function PropertyCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <PropertyCard
        name="Sunset Apartments"
        address="123 West Ave, Austin, TX"
        units={24}
        occupancy={92}
        monthlyRevenue="$48,000"
        activeLeads={12}
        conversionRate="38%"
        onClick={() => console.log("Property clicked")}
      />
      <PropertyCard
        name="Downtown Lofts"
        address="456 Main St, Austin, TX"
        units={18}
        occupancy={88}
        monthlyRevenue="$36,000"
        activeLeads={8}
        conversionRate="42%"
        onClick={() => console.log("Property clicked")}
      />
    </div>
  );
}
