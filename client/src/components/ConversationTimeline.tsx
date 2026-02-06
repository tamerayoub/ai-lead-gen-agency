import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Phone, Mail, MessageSquare, Trash2, Send, Facebook } from "lucide-react";
import { cn, linkifyText } from "@/lib/utils";
import { format, isToday, differenceInDays, parseISO } from "date-fns";
import { useMemo } from "react";

interface ConversationMessage {
  id: string;
  type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
  channel: "email" | "sms" | "phone" | "system" | "facebook";
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
  leadMetadata?: {
    facebookListingId?: string;
    facebookProfileName?: string;
    facebookConversationId?: string;
  } | null;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  system: Bot,
  facebook: Facebook,
};

const integrationLabels = {
  gmail: "Gmail",
  outlook: "Outlook",
  facebook: "Facebook",
};

export function ConversationTimeline({ messages, leadName, onRetryMessage, onDeleteMessage, leadMetadata }: ConversationTimelineProps) {
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

  // Check if we have any Facebook messages and need to show listing info
  const hasFacebookMessages = messages.some(msg => msg.channel === 'facebook');
  const facebookListingId = leadMetadata?.facebookListingId;
  const facebookProfileName = leadMetadata?.facebookProfileName || leadName;

  return (
    <div className="space-y-6">
      {/* Facebook Lead/Listing Info Header - show once if we have Facebook messages */}
      {hasFacebookMessages && (facebookListingId || facebookProfileName) && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 border">
          <div className="flex items-center gap-2">
            <Facebook className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Facebook Marketplace Conversation</span>
          </div>
          {facebookProfileName && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Lead:</span> {facebookProfileName}
            </div>
          )}
          {facebookListingId && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Listing ID:</span> {facebookListingId}
              <a 
                href={`https://www.facebook.com/marketplace/item/${facebookListingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline"
              >
                View on Facebook
              </a>
            </div>
          )}
        </div>
      )}
      
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
                    "p-3 overflow-hidden",
                    fromLead && "bg-accent/50 border-accent",
                    fromUs && "bg-primary text-primary-foreground border-primary"
                  )}>
                    <div className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {linkifyText(msg.message).map((part) => {
                        if (part.type === 'url') {
                          return (
                            <a
                              key={part.key}
                              href={part.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "underline hover:no-underline break-all",
                                fromUs ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                              )}
                              data-testid={`link-${part.key}`}
                            >
                              {part.content}
                            </a>
                          );
                        } else if (part.type === 'email') {
                          return (
                            <a
                              key={part.key}
                              href={`mailto:${part.content}`}
                              className={cn(
                                "underline hover:no-underline break-all",
                                fromUs ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                              )}
                              data-testid={`link-email-${part.key}`}
                            >
                              {part.content}
                            </a>
                          );
                        } else if (part.type === 'phone') {
                          return (
                            <a
                              key={part.key}
                              href={`tel:${part.content.replace(/\s/g, '')}`}
                              className={cn(
                                "underline hover:no-underline break-all",
                                fromUs ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                              )}
                              data-testid={`link-phone-${part.key}`}
                            >
                              {part.content}
                            </a>
                          );
                        } else {
                          return <span key={part.key}>{part.content}</span>;
                        }
                      })}
                    </div>
                  </Card>

                  {/* Timestamp with thread name and integration */}
                  <div className={cn(
                    "flex items-center gap-2 text-xs text-muted-foreground",
                    fromUs && "justify-end"
                  )}>
                    <span>{formatTimestamp(msg.timestamp)}</span>
                    {msg.channel === 'email' && msg.sourceIntegration && (
                      <>
                        <span>•</span>
                        <Mail className="h-3 w-3" />
                        <span className="font-medium" data-testid={`text-${msg.sourceIntegration}`}>
                          {integrationLabels[msg.sourceIntegration as keyof typeof integrationLabels]}
                        </span>
                      </>
                    )}
                    {msg.channel === 'facebook' && (
                      <>
                        <span>•</span>
                        <Facebook className="h-3 w-3" />
                        <span className="font-medium" data-testid="text-facebook">
                          Facebook
                        </span>
                        {leadMetadata?.facebookListingId && (
                          <>
                            <span>•</span>
                            <span className="text-xs" data-testid="text-facebook-listing">
                              Listing: {leadMetadata.facebookListingId}
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {msg.emailSubject && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[200px]" data-testid="text-thread-name">
                          {msg.emailSubject}
                        </span>
                      </>
                    )}
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
