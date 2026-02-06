import { Users, TrendingUp, Mail, Clock, ArrowRight, Facebook, Calendar, MessageSquare, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { format, isToday, differenceInDays, parseISO } from "date-fns";
import { LeadCard } from "@/components/LeadCard";

const statusColors: Record<string, string> = {
  new: "bg-status-new text-white",
  contacted: "bg-status-contacted text-white",
  prequalified: "bg-status-prequalified text-white",
  application: "bg-status-application text-white",
  approved: "bg-status-approved text-white",
};

const statusTitles: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  prequalified: "Pre-qualified",
  application: "Application Sent",
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats } = useQuery<any>({ 
    queryKey: ["/api/analytics/stats"],
    refetchInterval: 30000,
  });
  const { data: leads = [] } = useQuery<any[]>({ 
    queryKey: ["/api/leads"],
    refetchInterval: 30000,
  });
  const { data: notifications = [] } = useQuery<any[]>({ 
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
  });
  
  const isOwner = currentOrg?.role === 'owner';

  // Get recent leads (last 5)
  const recentLeads = leads
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  // Get recent notifications (last 5)
  const recentNotifications = notifications.slice(0, 5);

  // Calculate stats
  const totalLeads = stats?.totalLeads || leads.length;
  const leadsByStatus = leads.reduce((acc: Record<string, number>, lead: any) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const handleLeadClick = (leadId: string) => {
    setLocation(`/leads/${leadId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your leads and activity</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead to Tour Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leadToTourRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Leads that scheduled tours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"># of New Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.newLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.responseRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Messages responded to</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"># of Messages Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.messagesSent || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Leads</CardTitle>
              <button
                onClick={() => setLocation("/leads")}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="space-y-3">
                {recentLeads.map((lead: any) => (
                  <div
                    key={lead.id}
                    onClick={() => handleLeadClick(lead.id)}
                    className="cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{lead.name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.email || lead.phone || (
                            (lead.source === 'facebook' || (lead.metadata as any)?.facebookProfileId || lead.externalId) ? (
                              <a
                                href={`https://www.facebook.com/profile.php?id=${(lead.metadata as any)?.facebookProfileId || lead.externalId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Facebook className="h-3 w-3" />
                                View Facebook Profile
                              </a>
                            ) : (
                              "No contact info"
                            )
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[lead.status] || "bg-gray-500 text-white"}`}>
                          {statusTitles[lead.status] || lead.status}
                        </span>
                        {lead.createdAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatTimestamp(lead.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No leads yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {recentNotifications.length > 0 ? (
              <div className="space-y-3">
                {recentNotifications.map((notification: any) => (
                  <div key={notification.id} className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{notification.title}</div>
                        {notification.message && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </div>
                        )}
                      </div>
                      {notification.createdAt && (
                        <div className="text-xs text-muted-foreground ml-2">
                          {formatTimestamp(notification.createdAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(statusTitles).map(([status, title]) => (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold mb-1">{leadsByStatus[status] || 0}</div>
                <div className="text-sm text-muted-foreground">{title}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
