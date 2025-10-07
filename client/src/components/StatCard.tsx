import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  trend?: "up" | "down";
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>{value}</div>
        {change && (
          <p className={cn(
            "text-xs",
            changeType === "positive" && "text-status-success",
            changeType === "negative" && "text-status-danger",
            changeType === "neutral" && "text-muted-foreground"
          )} data-testid={`stat-change-${title.toLowerCase().replace(/\s/g, '-')}`}>
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
