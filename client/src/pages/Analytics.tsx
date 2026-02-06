import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Users, MessageSquare, Calendar, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Analytics() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const { data: stats } = useQuery<any>({ queryKey: ["/api/analytics/stats"] });
  const { data: trends = [] } = useQuery<any[]>({
    queryKey: ["/api/analytics/trends", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/trends?period=${period}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const barData = Object.entries(stats?.bySource || {}).map(([source, count]) => ({
    source: source.charAt(0).toUpperCase() + source.slice(1),
    count,
  }));

  const pieData = Object.entries(stats?.byStatus || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color:
      name === "new"
        ? "hsl(210 100% 56%)"
        : name === "contacted"
        ? "hsl(262 70% 60%)"
        : name === "prequalified"
        ? "hsl(38 92% 50%)"
        : name === "application"
        ? "hsl(280 65% 60%)"
        : "hsl(142 70% 45%)",
  }));

  const leadsByProperty = stats?.leadsByProperty || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your performance metrics</p>
        </div>
        <Select value={period} onValueChange={(v: "week" | "month" | "year") => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week by Week</SelectItem>
            <SelectItem value="month">Month over Month</SelectItem>
            <SelectItem value="year">Year over Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="New Leads"
          value={stats?.newLeads ?? 0}
          icon={Users}
        />
        <StatCard
          title="Response Rate"
          value={`${stats?.responseRate ?? 0}%`}
          icon={MessageSquare}
        />
        <StatCard
          title="Booked Tours"
          value={stats?.bookedTours ?? 0}
          icon={Calendar}
        />
        <StatCard
          title="Lead to Tour Rate"
          value={stats?.leadToTourRate ?? "0%"}
          icon={Percent}
        />
      </div>

      {/* Time charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tours Booked Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="tours" name="Tours" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Leads by Property + Leads by Source + Pipeline */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by Property</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsByProperty.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No property data yet</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {leadsByProperty.map((item: { propertyId: string; propertyName: string; leadCount: number }) => (
                  <div key={item.propertyId} className="flex items-center justify-between text-sm">
                    <span className="truncate">{item.propertyName}</span>
                    <span className="font-medium">{item.leadCount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="source" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
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
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
