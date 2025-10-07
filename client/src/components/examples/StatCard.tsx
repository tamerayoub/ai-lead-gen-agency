import { StatCard } from "../StatCard";
import { Users, TrendingUp } from "lucide-react";

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <StatCard
        title="Total Leads"
        value="245"
        change="+12% from last month"
        changeType="positive"
        icon={Users}
      />
      <StatCard
        title="Conversion Rate"
        value="34%"
        change="+5% from last month"
        changeType="positive"
        icon={TrendingUp}
      />
    </div>
  );
}
