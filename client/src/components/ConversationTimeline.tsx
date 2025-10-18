import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Phone, Mail, MessageSquare, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, differenceInDays, parseISO } from "date-fns";

interface ConversationMessage {
  id: string;
  type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
  channel: "email" | "sms" | "phone" | "system";
  message: string;
  timestamp: string;
  aiGenerated?: boolean;
  emailSubject?: string;
  sourceIntegration?: string;
  deliveryStatus?: "sent" | "failed" | "pending" | null;
  deliveryError?: string | null;
}

interface ConversationTimelineProps {
  messages: ConversationMessage[];
  leadName: string;
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  system: Bot,
};

const integrationLabels = {
  gmail: "Gmail",
  outlook: "Outlook",
};

export function ConversationTimeline({ messages, leadName, onRetryMessage, onDeleteMessage }: ConversationTimelineProps) {
  const isFromLead = (type: string) => type === "received" || type === "incoming" || type === "user";
  const isFromUs = (type: string) => type === "outgoing" || type === "sent" || type === "ai";

  const getLeadInitials = () => {
    return leadName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Try to parse the timestamp - handle both ISO format and date strings
      let date: Date;
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        // ISO format
        date = parseISO(timestamp);
      } else {
        // Try parsing as regular date string
        date = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timestamp;
      }

      const now = new Date();
      const daysDiff = differenceInDays(now, date);

      if (isToday(date)) {
        // Today: show time only (e.g., "2:30 PM")
        return format(date, "h:mm a");
      } else if (daysDiff <= 7) {
        // Within 7 days: show day of week and time (e.g., "Monday 2:30 PM")
        return format(date, "EEEE h:mm a");
      } else {
        // More than 7 days: show full date and time (e.g., "Jan 15, 2:30 PM")
        return format(date, "MMM d, h:mm a");
      }
    } catch (error) {
      // If parsing fails, return original timestamp
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No conversation yet
          </div>
        ) : (
          messages.map((msg) => {
            const ChannelIcon = channelIcons[msg.channel];
            const fromLead = isFromLead(msg.type);
            const fromUs = isFromUs(msg.type);

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 items-start",
                  fromUs && "flex-row-reverse"
                )}
                data-testid={`message-${msg.id}`}
              >
                {/* Avatar - only show for lead messages */}
                {fromLead && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {getLeadInitials()}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Message Content */}
                <div className={cn(
                  "flex-1 space-y-1",
                  fromLead && "max-w-[70%]",
                  fromUs && "flex flex-col items-end max-w-[70%] mr-3"
                )}>
                  {/* Sender Name - only show for lead messages */}
                  {fromLead && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{leadName}</span>
                      <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                      {msg.aiGenerated && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Bot className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* AI Badge for user messages */}
                  {fromUs && msg.aiGenerated && (
                    <div className="flex items-center gap-2 text-xs justify-end">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Bot className="h-3 w-3" />
                        AI
                      </Badge>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <Card className={cn(
                    "p-3",
                    fromLead && "bg-accent/50 border-accent",
                    fromUs && "bg-primary text-primary-foreground border-primary"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </Card>

                  {/* Email Metadata */}
                  {msg.channel === 'email' && (msg.emailSubject || msg.sourceIntegration) && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs text-muted-foreground mt-1",
                      fromUs && "justify-end"
                    )}>
                      <Mail className="h-3 w-3" />
                      {msg.sourceIntegration && (
                        <span className="font-medium" data-testid={`text-${msg.sourceIntegration}`}>
                          {integrationLabels[msg.sourceIntegration as keyof typeof integrationLabels]}
                        </span>
                      )}
                      {msg.emailSubject && (
                        <>
                          {msg.sourceIntegration && <span>•</span>}
                          <span className="truncate" data-testid="text-email-subject">
                            {msg.emailSubject}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Timestamp - shown below email metadata */}
                  <div className={cn(
                    "text-xs text-muted-foreground",
                    fromUs && "text-right"
                  )}>
                    {formatTimestamp(msg.timestamp)}
                  </div>

                  {/* Delivery Error */}
                  {fromUs && msg.deliveryStatus === 'failed' && msg.deliveryError && (
                    <div className={cn(
                      "rounded-md border border-destructive bg-destructive/10 p-2 space-y-2",
                      fromUs && "w-full"
                    )}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-destructive">Email failed to send</p>
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-delivery-error">
                            {msg.deliveryError}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {onRetryMessage && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs flex-1"
                            onClick={() => onRetryMessage(msg.id)}
                            data-testid="button-retry-email"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Retry Sending
                          </Button>
                        )}
                        {onDeleteMessage && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs flex-1"
                            onClick={() => onDeleteMessage(msg.id)}
                            data-testid="button-delete-message"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
