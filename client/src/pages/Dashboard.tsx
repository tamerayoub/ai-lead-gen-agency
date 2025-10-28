import { StatCard } from "@/components/StatCard";
import { LeadCard } from "@/components/LeadCard";
import { PropertyCard } from "@/components/PropertyCard";
import { AIActivityFeed } from "@/components/AIActivityFeed";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import { PendingRepliesQueue } from "@/components/PendingRepliesQueue";
import { UnreadMessagesWidget } from "@/components/UnreadMessagesWidget";
import { Users, TrendingUp, Clock, Building2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, differenceInDays, parseISO } from "date-fns";

const formatTimestamp = (timestamp: string) => {
  try {
    let date: Date;
    if (timestamp.includes('T') || timestamp.includes('Z')) {
      date = parseISO(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return timestamp;
    }

    const now = new Date();
    const daysDiff = differenceInDays(now, date);

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (daysDiff <= 7) {
      return format(date, "EEEE h:mm a");
    } else {
      return format(date, "MMM d, h:mm a");
    }
  } catch (error) {
    return timestamp;
  }
};

export default function Dashboard() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: leads = [] } = useQuery<any[]>({ 
    queryKey: ["/api/leads"],
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
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
              {recentLeads.map((lead) => {
                // Map backend source values to LeadCard source types
                const sourceMap: Record<string, "email" | "phone" | "sms" | "listing"> = {
                  gmail: "email",
                  outlook: "email",
                  email: "email",
                  phone: "phone",
                  sms: "sms",
                  twilio: "sms",
                  messenger: "sms",
                  facebook: "listing",
                  zillow: "listing",
                  listing: "listing",
                };
                const mappedSource = sourceMap[lead.source.toLowerCase()] || "email";
                
                return (
                  <LeadCard
                    key={lead.id}
                    name={lead.name}
                    email={lead.email}
                    phone={lead.phone}
                    property={lead.propertyName}
                    status={lead.status}
                    source={mappedSource}
                    aiHandled={lead.aiHandled}
                    lastContact={formatTimestamp(lead.lastContactAt)}
                    onClick={() => setSelectedLeadId(lead.id)}
                  />
                );
              })}
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

        <div className="space-y-4">
          <UnreadMessagesWidget onLeadClick={setSelectedLeadId} />
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
            timestamp: c.createdAt,
          })) || [],
          notes: (selectedLeadData as any).notes?.map((n: any) => ({
            ...n,
            timestamp: n.createdAt,
          })) || [],
        } : null}
      />
    </div>
  );
}
