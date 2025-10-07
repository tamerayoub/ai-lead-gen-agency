import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Phone, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationMessage {
  id: string;
  type: "ai" | "user" | "system";
  channel: "email" | "sms" | "phone" | "system";
  message: string;
  timestamp: string;
  aiGenerated?: boolean;
}

interface ConversationTimelineProps {
  messages: ConversationMessage[];
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  system: Bot,
};

export function ConversationTimeline({ messages }: ConversationTimelineProps) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        const ChannelIcon = channelIcons[msg.channel];
        const isAI = msg.type === "ai";
        const isSystem = msg.type === "system";

        return (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              !isAI && !isSystem && "flex-row-reverse"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              isAI && "bg-primary/10 text-primary",
              isSystem && "bg-muted text-muted-foreground",
              !isAI && !isSystem && "bg-accent text-accent-foreground"
            )}>
              {isAI || isSystem ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            <div className={cn("flex-1 space-y-1", !isAI && !isSystem && "flex flex-col items-end")}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {isAI ? "AI Assistant" : isSystem ? "System" : "Lead"}
                </span>
                <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                {msg.aiGenerated && (
                  <Badge variant="secondary" className="gap-1">
                    <Bot className="h-3 w-3" />
                    Auto
                  </Badge>
                )}
              </div>
              <Card className={cn(
                "p-3",
                !isAI && !isSystem && "bg-primary text-primary-foreground"
              )}>
                <p className="text-sm">{msg.message}</p>
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
}
