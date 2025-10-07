import { LeadPipeline } from "@/components/LeadPipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Filter } from "lucide-react";
import { LeadCard } from "@/components/LeadCard";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import { useState } from "react";

export default function Leads() {
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
        message: "Hello! Yes, the 2BR apartment is available. Monthly rent is $2,400. Would you like to schedule a viewing?",
        timestamp: "2 hours ago",
        aiGenerated: true,
      },
    ],
    notes: [
      {
        id: "1",
        content: "Lead shows strong interest. Income verified at $85k/year.",
        timestamp: "1 hour ago",
        aiGenerated: true,
      },
    ],
  };

  const pipelineStages = [
    {
      stage: "new" as const,
      title: "New",
      count: 8,
      color: "bg-status-new text-white",
      leads: [
        { id: "1", name: "Sarah Johnson", property: "Sunset Apt 2BR", value: "$2,400/mo" },
        { id: "2", name: "Mike Davis", property: "Downtown Loft", value: "$2,800/mo" },
      ],
    },
    {
      stage: "contacted" as const,
      title: "Contacted",
      count: 12,
      color: "bg-status-contacted text-white",
      leads: [
        { id: "3", name: "Emma Wilson", property: "Garden View 3BR", value: "$3,200/mo" },
        { id: "4", name: "James Lee", property: "Parkside Studio", value: "$1,800/mo" },
      ],
    },
    {
      stage: "prequalified" as const,
      title: "Pre-qualified",
      count: 6,
      color: "bg-status-prequalified text-white",
      leads: [
        { id: "5", name: "Lisa Anderson", property: "Riverside 2BR", value: "$2,600/mo" },
      ],
    },
    {
      stage: "application" as const,
      title: "Application Sent",
      count: 4,
      color: "bg-status-application text-white",
      leads: [
        { id: "6", name: "Robert Taylor", property: "Hilltop 1BR", value: "$2,200/mo" },
      ],
    },
    {
      stage: "approved" as const,
      title: "Approved",
      count: 3,
      color: "bg-status-approved text-white",
      leads: [
        { id: "7", name: "Jennifer Moore", property: "Lakeside 2BR", value: "$2,900/mo" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage and track your property leads</p>
        </div>
        <Button data-testid="button-add-lead">
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <Button variant="outline" data-testid="button-filter">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">List View</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-6">
          <LeadPipeline stages={pipelineStages} />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </TabsContent>
      </Tabs>

      <LeadDetailSheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        lead={selectedLead}
      />
    </div>
  );
}
