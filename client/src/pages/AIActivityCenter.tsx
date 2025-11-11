import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Phone, Mail, MessageSquare, Search, Filter, CheckCircle, Clock, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

interface Activity {
  id: string;
  type: "response" | "followup" | "qualification" | "note";
  channel: "email" | "sms" | "phone";
  leadName: string;
  leadEmail?: string;
  action: string;
  message?: string;
  timestamp: string;
  status: "success" | "pending" | "failed";
  aiGenerated: boolean;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
};

const channelColors = {
  email: "bg-blue-500/10 text-blue-500",
  sms: "bg-green-500/10 text-green-500",
  phone: "bg-blue-500/10 text-blue-500",
};

const statusIcons = {
  success: CheckCircle,
  pending: Clock,
  failed: XCircle,
};

export default function AIActivityCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: activities = [], isLoading } = useQuery<Activity[]>({ 
    queryKey: ["/api/ai-activity"],
    select: (data: any[]) => data.map(activity => ({
      ...activity,
      timestamp: activity.createdAt 
        ? formatTimestamp(activity.createdAt)
        : activity.timestamp || 'Unknown time',
    }))
  });

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activity.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === "all" || activity.channel === channelFilter;
    const matchesStatus = statusFilter === "all" || activity.status === statusFilter;
    
    return matchesSearch && matchesChannel && matchesStatus;
  });

  const emailActivities = filteredActivities.filter(a => a.channel === "email");
  const smsActivities = filteredActivities.filter(a => a.channel === "sms");
  const phoneActivities = filteredActivities.filter(a => a.channel === "phone");

  const ActivityCard = ({ activity }: { activity: Activity }) => {
    const ChannelIcon = channelIcons[activity.channel];
    const StatusIcon = statusIcons[activity.status];
    
    return (
      <Card className="hover-elevate" data-testid={`activity-${activity.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${channelColors[activity.channel]}`}>
              <ChannelIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate" data-testid={`text-lead-name-${activity.id}`}>
                  {activity.leadName}
                </span>
                {activity.aiGenerated && (
                  <Badge variant="secondary" className="gap-1">
                    <Bot className="h-3 w-3" />
                    AI
                  </Badge>
                )}
                <Badge variant="outline">{activity.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground" data-testid={`text-action-${activity.id}`}>
                {activity.action}
              </p>
              {activity.message && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md" data-testid={`text-message-${activity.id}`}>
                  {activity.message}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusIcon className={`h-3 w-3 ${
                  activity.status === 'success' ? 'text-status-success' : 
                  activity.status === 'failed' ? 'text-destructive' : ''
                }`} />
                <span>{activity.status}</span>
                <span>•</span>
                <span data-testid={`text-timestamp-${activity.id}`}>{activity.timestamp}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Activity Center</h1>
        <p className="text-muted-foreground mt-1">Monitor all AI communications across email, SMS, and phone in real-time</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by lead name or action..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-activity"
                />
              </div>
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-channel-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">
            All Activity
            <Badge variant="secondary" className="ml-2">{filteredActivities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="h-4 w-4 mr-2" />
            Email
            <Badge variant="secondary" className="ml-2">{emailActivities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-sms">
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS
            <Badge variant="secondary" className="ml-2">{smsActivities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="phone" data-testid="tab-phone">
            <Phone className="h-4 w-4 mr-2" />
            Phone
            <Badge variant="secondary" className="ml-2">{phoneActivities.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Loading activity...
              </CardContent>
            </Card>
          ) : filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No activities found
              </CardContent>
            </Card>
          ) : (
            filteredActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-6 space-y-4">
          {emailActivities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No email activities found
              </CardContent>
            </Card>
          ) : (
            emailActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          )}
        </TabsContent>

        <TabsContent value="sms" className="mt-6 space-y-4">
          {smsActivities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No SMS activities found
              </CardContent>
            </Card>
          ) : (
            smsActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          )}
        </TabsContent>

        <TabsContent value="phone" className="mt-6 space-y-4">
          {phoneActivities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No phone activities found
              </CardContent>
            </Card>
          ) : (
            phoneActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
