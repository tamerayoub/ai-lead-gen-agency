import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Phone, Mail, MessageSquare, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { SiGmail, SiMicrosoftoutlook } from "react-icons/si";

interface ConversationMessage {
  id: string;
  type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
  channel: "email" | "sms" | "phone" | "system";
  message: string;
  timestamp: string;
  aiGenerated?: boolean;
  emailSubject?: string;
  sourceIntegration?: string;
}

interface ConversationTimelineProps {
  messages: ConversationMessage[];
  leadName: string;
  onSendMessage?: (message: string) => void;
  onAIReply?: () => void;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  system: Bot,
};

const integrationIcons = {
  gmail: SiGmail,
  outlook: SiMicrosoftoutlook,
};

export function ConversationTimeline({ messages, leadName, onSendMessage, onAIReply }: ConversationTimelineProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Determine if message is from lead (received/incoming/user) or from us (outgoing/sent/ai)
  const isFromLead = (type: string) => type === "received" || type === "incoming" || type === "user";
  const isFromUs = (type: string) => type === "outgoing" || type === "sent" || type === "ai";

  const handleSend = async () => {
    if (!newMessage.trim() || !onSendMessage) return;
    
    setIsSending(true);
    try {
      await onSendMessage(newMessage);
      setNewMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getLeadInitials = () => {
    return leadName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
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
                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={cn(
                    fromLead && "bg-accent text-accent-foreground",
                    fromUs && "bg-primary text-primary-foreground"
                  )}>
                    {fromLead ? getLeadInitials() : "ME"}
                  </AvatarFallback>
                </Avatar>

                {/* Message Content */}
                <div className={cn(
                  "flex-1 space-y-1 max-w-[70%]",
                  fromUs && "flex flex-col items-end"
                )}>
                  {/* Sender Name & Timestamp */}
                  <div className={cn(
                    "flex items-center gap-2 text-xs",
                    fromUs && "flex-row-reverse"
                  )}>
                    <span className="font-medium">
                      {fromLead ? leadName : "You"}
                    </span>
                    <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{msg.timestamp}</span>
                    {msg.aiGenerated && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Bot className="h-3 w-3" />
                        AI
                      </Badge>
                    )}
                  </div>

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
                      "flex items-center gap-2 text-xs text-muted-foreground mt-1",
                      fromUs && "justify-end"
                    )}>
                      {msg.sourceIntegration && (() => {
                        const IntegrationIcon = integrationIcons[msg.sourceIntegration as keyof typeof integrationIcons];
                        return IntegrationIcon ? (
                          <IntegrationIcon className="h-3 w-3" data-testid={`icon-${msg.sourceIntegration}`} />
                        ) : null;
                      })()}
                      {msg.emailSubject && (
                        <span className="truncate" data-testid="text-email-subject">
                          {msg.emailSubject}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            data-testid="input-reply-message"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {onAIReply && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onAIReply}
            data-testid="button-ai-reply"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Reply
          </Button>
        )}
      </div>
    </div>
  );
}
