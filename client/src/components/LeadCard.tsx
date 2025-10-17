import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Mail, MessageSquare, Bot, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeadStatus = "new" | "contacted" | "prequalified" | "application" | "approved";

interface LeadCardProps {
  name: string;
  email: string;
  phone: string;
  property: string;
  status: LeadStatus;
  source: "email" | "phone" | "sms" | "listing";
  aiHandled?: boolean;
  lastContact?: string;
  onClick?: () => void;
}

const statusColors: Record<LeadStatus, string> = {
  new: "bg-status-new text-white",
  contacted: "bg-status-contacted text-white",
  prequalified: "bg-status-prequalified text-white",
  application: "bg-status-application text-white",
  approved: "bg-status-approved text-white",
};

const sourceIcons = {
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  listing: Building2,
};

export function LeadCard({ name, email, phone, property, status, source, aiHandled, lastContact, onClick }: LeadCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  
  const SourceIcon = sourceIcons[source];

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick} data-testid={`card-lead-${name.toLowerCase().replace(/\s/g, '-')}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{name}</h3>
            <p className="text-xs text-muted-foreground truncate">{property}</p>
          </div>
        </div>
        {aiHandled && (
          <Badge variant="secondary" className="gap-1 shrink-0">
            <Bot className="h-3 w-3" />
            AI
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <SourceIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground truncate">{email}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn(statusColors[status])} data-testid={`badge-status-${status}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          {lastContact && (
            <span className="text-xs text-muted-foreground">{lastContact}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
