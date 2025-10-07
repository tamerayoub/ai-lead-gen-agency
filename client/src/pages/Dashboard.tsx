import { StatCard } from "@/components/StatCard";
import { LeadCard } from "@/components/LeadCard";
import { PropertyCard } from "@/components/PropertyCard";
import { AIActivityFeed } from "@/components/AIActivityFeed";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import { Users, TrendingUp, Clock, Building2 } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const sampleLead = {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+1 555-0123",
    property: "Sunset Apartments 2BR",
    status: "prequalified" as const,
    income: "$85,000/year",
    moveInDate: "April 1, 2024",
    qualificationScore: 85,
    conversations: [
      {
        id: "1",
        type: "user" as const,
        channel: "email" as const,
        message: "Hi, I'm interested in the 2BR apartment. Is it still available?",
        timestamp: "2 hours ago",
      },
      {
        id: "2",
        type: "ai" as const,
        channel: "email" as const,
        message: "Hello! Yes, the 2BR apartment is available. It features modern amenities and a balcony. Monthly rent is $2,400. Would you like to schedule a viewing?",
        timestamp: "2 hours ago",
        aiGenerated: true,
      },
    ],
    notes: [
      {
        id: "1",
        content: "Lead shows strong interest. Income verified at $85k/year. Credit score pending.",
        timestamp: "1 hour ago",
        aiGenerated: true,
      },
    ],
  };

  const activities = [
    {
      id: "1",
      type: "response" as const,
      channel: "email" as const,
      leadName: "Sarah Johnson",
      action: "Responded to inquiry about 2BR apartment",
      timestamp: "5 min ago",
      status: "success" as const,
    },
    {
      id: "2",
      type: "followup" as const,
      channel: "sms" as const,
      leadName: "Mike Davis",
      action: "Sent follow-up about viewing appointment",
      timestamp: "15 min ago",
      status: "success" as const,
    },
    {
      id: "3",
      type: "qualification" as const,
      channel: "phone" as const,
      leadName: "Emma Wilson",
      action: "Pre-qualified lead based on income verification",
      timestamp: "1 hour ago",
      status: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your lead activity overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          title="Avg Response Time"
          value="2.3 min"
          change="-15% from last month"
          changeType="positive"
          icon={Clock}
        />
        <StatCard
          title="Active Properties"
          value="8"
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
              <LeadCard
                name="Sarah Johnson"
                email="sarah.j@email.com"
                phone="+1 555-0123"
                property="Sunset Apartments 2BR"
                status="new"
                source="email"
                aiHandled={true}
                lastContact="2 hours ago"
                onClick={() => setSelectedLead(sampleLead)}
              />
              <LeadCard
                name="Michael Chen"
                email="m.chen@email.com"
                phone="+1 555-0456"
                property="Downtown Loft 1BR"
                status="prequalified"
                source="phone"
                aiHandled={true}
                lastContact="1 day ago"
                onClick={() => setSelectedLead(sampleLead)}
              />
              <LeadCard
                name="Emma Wilson"
                email="emma.w@email.com"
                phone="+1 555-0789"
                property="Garden View 3BR"
                status="contacted"
                source="sms"
                aiHandled={true}
                lastContact="3 hours ago"
                onClick={() => setSelectedLead(sampleLead)}
              />
              <LeadCard
                name="James Lee"
                email="j.lee@email.com"
                phone="+1 555-0321"
                property="Parkside Studio"
                status="application"
                source="listing"
                aiHandled={false}
                lastContact="5 hours ago"
                onClick={() => setSelectedLead(sampleLead)}
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Top Properties</h2>
            <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </div>

        <div>
          <AIActivityFeed activities={activities} />
        </div>
      </div>

      <LeadDetailSheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        lead={selectedLead}
      />
    </div>
  );
}
