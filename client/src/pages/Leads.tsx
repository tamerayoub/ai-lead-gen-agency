import { LeadPipeline } from "@/components/LeadPipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Filter } from "lucide-react";
import { LeadCard } from "@/components/LeadCard";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import LeadCreateDialog from "@/components/LeadCreateDialog";
import LeadFilterDialog, { type LeadFilters } from "@/components/LeadFilterDialog";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isToday, differenceInDays, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LeadStatus } from "@/components/LeadCard";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  new: "bg-status-new text-white",
  contacted: "bg-status-contacted text-white",
  prequalified: "bg-status-prequalified text-white",
  tour: "bg-status-prequalified text-white", // Using prequalified color for tour
  application: "bg-status-application text-white",
  approved: "bg-status-approved text-white",
};

const statusTitles: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  prequalified: "Pre-qualified",
  tour: "Tour",
  application: "Application",
  approved: "Approved",
};

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

export default function Leads() {
  const [location, setLocation] = useLocation();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<LeadFilters>({
    statuses: [],
    sources: [],
    propertyIds: [],
    aiHandled: "all",
  });
  
  // Navigate to full profile when clicking a lead
  const handleLeadClick = (leadId: string) => {
    setLocation(`/leads/${leadId}`);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pipeline");
  const { toast } = useToast();
  const { data: leads = [] } = useQuery<any[]>({ 
    queryKey: ["/api/leads"],
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
  const { data: selectedLeadData } = useQuery({
    queryKey: ["/api/leads", selectedLeadId],
    enabled: !!selectedLeadId,
  });

  // Read 'selected' query parameter from URL and open lead detail
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const selectedParam = params.get('selected');
    if (selectedParam) {
      setSelectedLeadId(selectedParam);
      setActiveTab("list"); // Switch to list view for better UX
      // Clean URL after reading parameter
      setTimeout(() => {
        setLocation('/leads', { replace: true });
      }, 100);
    }
  }, [location, setLocation]);

  // Mutation to update lead status
  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead updated",
        description: "Lead status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    },
  });

  // Handle lead status change from drag and drop
  const handleLeadStatusChange = (leadId: string, newStatus: LeadStatus) => {
    updateLeadStatusMutation.mutate({ leadId, status: newStatus });
  };

  // Filter leads based on search query and filters
  const filteredLeads = leads.filter((lead) => {
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query) ||
        lead.propertyName?.toLowerCase().includes(query) ||
        lead.status?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(lead.status)) {
      return false;
    }

    // Source filter
    if (filters.sources.length > 0) {
      const leadSource = lead.source?.toLowerCase() || "";
      if (!filters.sources.includes(leadSource)) {
        return false;
      }
    }

    // Property filter
    if (filters.propertyIds.length > 0 && (!lead.propertyId || !filters.propertyIds.includes(lead.propertyId))) {
      return false;
    }

    // AI Handled filter
    if (filters.aiHandled !== "all") {
      const isAiHandled = lead.aiHandled === true;
      if (filters.aiHandled === "true" && !isAiHandled) return false;
      if (filters.aiHandled === "false" && isAiHandled) return false;
    }

    return true;
  });

  // Count active filters
  const activeFilterCount = 
    filters.statuses.length +
    filters.sources.length +
    filters.propertyIds.length +
    (filters.aiHandled !== "all" ? 1 : 0);

  // Group leads by status
  const leadsByStatus = filteredLeads.reduce((acc: Record<string, any[]>, lead: any) => {
    if (!acc[lead.status]) acc[lead.status] = [];
    acc[lead.status].push(lead);
    return acc;
  }, {} as Record<string, any[]>);

  const pipelineStages = Object.keys(statusTitles).map(status => ({
    stage: status as any,
    title: statusTitles[status],
    count: leadsByStatus[status]?.length || 0,
    color: statusColors[status],
    leads: (leadsByStatus[status] || []).map(lead => ({
      id: lead.id,
      name: lead.name,
      property: lead.propertyName,
      value: "", // Don't show default rent - only show if actual rent data exists
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage and track your property leads</p>
        </div>
        <Button 
          data-testid="button-add-lead"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email, phone, property, or status..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-leads"
          />
        </div>
        <Button 
          variant="outline" 
          data-testid="button-filter"
          onClick={() => setIsFilterDialogOpen(true)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">List View</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-6">
          <LeadPipeline 
            stages={pipelineStages} 
            onLeadStatusChange={handleLeadStatusChange}
            onLeadClick={handleLeadClick}
          />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {searchQuery ? `No leads found matching "${searchQuery}"` : 'No leads yet'}
              </div>
            ) : (
              filteredLeads.map((lead) => {
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
                    onClick={() => handleLeadClick(lead.id)}
                  />
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <LeadCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <LeadFilterDialog
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        filters={filters}
        onApplyFilters={setFilters}
      />

      <LeadDetailSheet
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        onExpand={() => {
          if (selectedLeadId) {
            setLocation(`/leads/${selectedLeadId}`);
            setSelectedLeadId(null);
          }
        }}
        lead={selectedLeadData ? {
          id: (selectedLeadData as any).id,
          name: (selectedLeadData as any).name,
          email: (selectedLeadData as any).email,
          phone: (selectedLeadData as any).phone,
          property: (selectedLeadData as any).propertyName,
          status: (selectedLeadData as any).status,
          income: (selectedLeadData as any).income,
          moveInDate: (selectedLeadData as any).moveInDate,
          qualificationScore: (selectedLeadData as any).qualificationScore,
          conversations: (selectedLeadData as any).conversations?.map((c: any) => ({
            ...c,
            timestamp: c.createdAt,
          })) || [],
          notes: (selectedLeadData as any).notes?.map((n: any) => ({
            ...n,
            timestamp: formatTimestamp(n.createdAt),
          })) || [],
        } : null}
      />
    </div>
  );
}
