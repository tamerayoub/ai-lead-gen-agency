import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, ClipboardList, TrendingUp, Building2, UserPlus, Percent } from "lucide-react";

interface AdminAnalytics {
  totalSignups: number;
  totalDemoRequests: number;
  totalOnboardingSubmissions: number;
  totalOrganizations: number;
  totalProspects: number;
  conversionRate: string;
  prospectsByStage: { stage: string; count: number }[];
  signupTrend: { month: string; signups: number }[];
  demoRequestTrend: { month: string; requests: number }[];
}

export default function AdminAnalytics() {
  const { data: analytics, isLoading, error } = useQuery<AdminAnalytics>({ 
    queryKey: ["/api/admin/analytics"] 
  });

  const stageColors: Record<string, string> = {
    discovery: "hsl(210 100% 56%)",
    evaluation: "hsl(262 70% 60%)",
    probing: "hsl(38 92% 50%)",
    offer: "hsl(280 65% 60%)",
    sale: "hsl(142 70% 45%)",
    onboard: "hsl(160 60% 50%)"
  };

  const pieData = analytics?.prospectsByStage?.map((item) => ({
    name: item.stage.charAt(0).toUpperCase() + item.stage.slice(1),
    value: item.count,
    color: stageColors[item.stage] || "hsl(var(--primary))"
  })) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-destructive mb-2">Failed to Load Analytics</h2>
            <p className="text-muted-foreground">There was an error loading the platform analytics. Please try refreshing the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="heading-admin-analytics">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">Monitor platform-wide metrics and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-total-signups">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-signups">
              {analytics?.totalSignups || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              User accounts created
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-demo-requests">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demo Requests</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-demo-requests">
              {analytics?.totalDemoRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requests submitted
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-onboarding-submissions">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onboarding Submissions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-onboarding-submissions">
              {analytics?.totalOnboardingSubmissions || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Questionnaires completed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-paying-customers">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paying Customers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-paying-customers">
              {analytics?.totalOrganizations || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active organizations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-sales-prospects">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Prospects</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-sales-prospects">
              {analytics?.totalProspects || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In sales pipeline
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-conversion-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-conversion-rate">
              {analytics?.conversionRate || "0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Prospects to customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-signup-trend">
          <CardHeader>
            <CardTitle className="text-base">Signup Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.signupTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="signups" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-demo-request-trend">
          <CardHeader>
            <CardTitle className="text-base">Demo Request Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.demoRequestTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="requests" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-pipeline-distribution">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-pipeline-legend">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
