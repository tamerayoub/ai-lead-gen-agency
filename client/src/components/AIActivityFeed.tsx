import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Phone, Mail, MessageSquare, CheckCircle } from "lucide-react";

interface AIActivity {
  id: string;
  type: "response" | "followup" | "qualification" | "note";
  channel: "email" | "sms" | "phone";
  leadName: string;
  action: string;
  timestamp: string;
  status: "success" | "pending";
}

interface AIActivityFeedProps {
  activities: AIActivity[];
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
};

export function AIActivityFeed({ activities }: AIActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Recent AI Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => {
          const ChannelIcon = channelIcons[activity.channel];
          
          return (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50" data-testid={`activity-${activity.id}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <ChannelIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{activity.leadName}</span>
                  {activity.status === "success" && (
                    <CheckCircle className="h-3 w-3 text-status-success shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{activity.action}</p>
                <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
              </div>
              <Badge variant="secondary" className="shrink-0">{activity.type}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
