import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MapPin, DollarSign, Calendar, Send } from "lucide-react";
import { LeadStatus } from "./LeadCard";
import { ConversationTimeline } from "./ConversationTimeline";
import { cn } from "@/lib/utils";

interface LeadDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  property: string;
  status: LeadStatus;
  income?: string;
  moveInDate?: string;
  qualificationScore?: number;
  conversations: Array<{
    id: string;
    type: "ai" | "user" | "system";
    channel: "email" | "sms" | "phone" | "system";
    message: string;
    timestamp: string;
    aiGenerated?: boolean;
  }>;
  notes: Array<{
    id: string;
    content: string;
    timestamp: string;
    aiGenerated: boolean;
  }>;
}

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadDetails | null;
}

const statusColors: Record<LeadStatus, string> = {
  new: "bg-status-new text-white",
  contacted: "bg-status-contacted text-white",
  prequalified: "bg-status-prequalified text-white",
  application: "bg-status-application text-white",
  approved: "bg-status-approved text-white",
};

export function LeadDetailSheet({ open, onOpenChange, lead }: LeadDetailSheetProps) {
  if (!lead) return null;

  const initials = lead.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-lead-detail">
        <SheetHeader className="pb-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <SheetTitle className="text-xl">{lead.name}</SheetTitle>
              <Badge className={cn(statusColors[lead.status])}>
                {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{lead.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{lead.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{lead.property}</span>
            </div>
            {lead.income && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Income: {lead.income}</span>
              </div>
            )}
            {lead.moveInDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Move-in: {lead.moveInDate}</span>
              </div>
            )}
          </div>

          {lead.qualificationScore !== undefined && (
            <div className="p-4 rounded-md bg-muted">
              <div className="text-sm font-medium mb-2">Qualification Score</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${lead.qualificationScore}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{lead.qualificationScore}%</span>
              </div>
            </div>
          )}

          <Tabs defaultValue="conversation" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="conversation" className="flex-1" data-testid="tab-conversation">Conversation</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1" data-testid="tab-notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="conversation" className="space-y-4 mt-4">
              <ConversationTimeline messages={lead.conversations} />
            </TabsContent>
            <TabsContent value="notes" className="space-y-3 mt-4">
              {lead.notes.map((note) => (
                <div key={note.id} className="p-3 rounded-md bg-muted space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{note.timestamp}</span>
                    {note.aiGenerated && (
                      <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                    )}
                  </div>
                  <p className="text-sm">{note.content}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button className="flex-1" data-testid="button-send-application">
              <Send className="h-4 w-4 mr-2" />
              Send Application
            </Button>
            <Button variant="outline" className="flex-1" data-testid="button-schedule-viewing">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Viewing
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
