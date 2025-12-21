import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, Users, TrendingUp, Edit, Image as ImageIcon } from "lucide-react";

interface PropertyCardProps {
  name: string;
  address: string;
  units: number;
  occupancy: number;
  monthlyRevenue: string;
  activeLeads: number;
  conversionRate: string;
  coverPhoto?: string;
  onClick?: () => void;
  onEdit?: () => void;
}

export function PropertyCard({
  name,
  address,
  units,
  occupancy,
  monthlyRevenue,
  activeLeads,
  conversionRate,
  coverPhoto,
  onClick,
  onEdit,
}: PropertyCardProps) {
  return (
    <Card className="hover-elevate cursor-pointer overflow-hidden" onClick={onClick} data-testid={`card-property-${name.toLowerCase().replace(/\s/g, '-')}`}>
      {/* Cover Photo */}
      {coverPhoto ? (
        <div className="w-full h-48 overflow-hidden bg-muted">
          <img
            src={coverPhoto}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-muted flex items-center justify-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{name}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{address}</span>
            </div>
          </div>
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid={`button-edit-property-${name.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
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
