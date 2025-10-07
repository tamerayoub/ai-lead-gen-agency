import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Users, TrendingUp } from "lucide-react";

interface PropertyCardProps {
  name: string;
  address: string;
  units: number;
  occupancy: number;
  monthlyRevenue: string;
  activeLeads: number;
  conversionRate: string;
  onClick?: () => void;
}

export function PropertyCard({
  name,
  address,
  units,
  occupancy,
  monthlyRevenue,
  activeLeads,
  conversionRate,
  onClick,
}: PropertyCardProps) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick} data-testid={`card-property-${name.toLowerCase().replace(/\s/g, '-')}`}>
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="text-xs">{address}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Occupancy</div>
            <div className="text-lg font-semibold">{occupancy}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Units</div>
            <div className="text-lg font-semibold">{units}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>Revenue</span>
            </div>
            <span className="text-sm font-medium">{monthlyRevenue}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>Active Leads</span>
            </div>
            <Badge variant="secondary">{activeLeads}</Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Conversion</span>
            </div>
            <span className="text-sm font-medium text-status-success">{conversionRate}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
