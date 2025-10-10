import { StatCard } from "@/components/StatCard";
import { LeadCard } from "@/components/LeadCard";
import { PropertyCard } from "@/components/PropertyCard";
import { AIActivityFeed } from "@/components/AIActivityFeed";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import { PendingRepliesQueue } from "@/components/PendingRepliesQueue";
import { Users, TrendingUp, Clock, Building2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: leads = [] } = useQuery<any[]>({ queryKey: ["/api/leads"] });
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/analytics/stats"] });
  const { data: activities = [] } = useQuery<any[]>({ queryKey: ["/api/ai-activity"] });
  const { data: selectedLeadData } = useQuery({
    queryKey: ["/api/leads", selectedLeadId],
    enabled: !!selectedLeadId,
  });

  const recentLeads = leads.slice(0, 4);
  const topProperties = properties.slice(0, 2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your lead activity overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          change="+12% from last month"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="Conversion Rate"
          value={stats?.conversionRate || "0%"}
          change="+5% from last month"
          changeType="positive"
          icon={TrendingUp}
        />
        <StatCard
          title="Avg Response Time"
          value={stats?.avgResponseTime || "N/A"}
          change="-15% from last month"
          changeType="positive"
          icon={Clock}
        />
        <StatCard
          title="Active Properties"
          value={stats?.activeProperties || 0}
          change="2 new this month"
          changeType="neutral"
          icon={Building2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Leads</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {recentLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  name={lead.name}
                  email={lead.email}
                  phone={lead.phone}
                  property={lead.propertyName}
                  status={lead.status}
                  source={lead.source}
                  aiHandled={lead.aiHandled}
                  lastContact={formatDistanceToNow(new Date(lead.lastContactAt), { addSuffix: true })}
                  onClick={() => setSelectedLeadId(lead.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Top Properties</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {topProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  name={property.name}
                  address={property.address}
                  units={property.units}
                  occupancy={property.occupancy}
                  monthlyRevenue={property.monthlyRevenue}
                  activeLeads={property.activeLeads}
                  conversionRate={property.conversionRate}
                  onClick={() => console.log("Property clicked")}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <AIActivityFeed activities={activities} />
        </div>
      </div>

      <div className="mt-6">
        <PendingRepliesQueue />
      </div>

      <LeadDetailSheet
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        lead={selectedLeadData ? {
          ...selectedLeadData,
          conversations: (selectedLeadData as any).conversations?.map((c: any) => ({
            ...c,
            timestamp: formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }),
          })) || [],
          notes: (selectedLeadData as any).notes?.map((n: any) => ({
            ...n,
            timestamp: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }),
          })) || [],
        } : null}
      />
    </div>
  );
}
