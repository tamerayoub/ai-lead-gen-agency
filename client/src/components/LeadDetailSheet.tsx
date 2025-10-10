import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MapPin, DollarSign, Calendar, Send, Edit2, X, Check } from "lucide-react";
import { LeadStatus } from "./LeadCard";
import { ConversationTimeline } from "./ConversationTimeline";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "" as LeadStatus,
    income: "",
    moveInDate: "",
  });
  const { toast } = useToast();

  const updateLeadMutation = useMutation({
    mutationFn: async (data: Partial<typeof editForm>) => {
      return await apiRequest(`/api/leads/${lead?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id] });
      toast({
        title: "Success",
        description: "Lead updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  // Shared reset helper to restore server data
  const resetToServerData = () => {
    if (lead) {
      setEditForm({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
      });
      setIsEditing(false);
    }
  };

  // Reset when sheet opens or closes
  const handleOpenChange = (newOpen: boolean) => {
    resetToServerData();
    onOpenChange(newOpen);
  };

  // Reset when lead data changes (but not when actively editing to avoid losing user input)
  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
      });
    }
  }, [lead, isEditing]);

  const handleSave = () => {
    updateLeadMutation.mutate(editForm);
  };

  const handleCancel = () => {
    resetToServerData();
  };

  if (!lead) return null;

  const initials = lead.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-lead-detail">
        <SheetHeader className="pb-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <SheetTitle className="text-xl">{isEditing ? editForm.name : lead.name}</SheetTitle>
              <Badge className={cn(statusColors[isEditing ? editForm.status : lead.status])}>
                {(isEditing ? editForm.status : lead.status).charAt(0).toUpperCase() + (isEditing ? editForm.status : lead.status).slice(1)}
              </Badge>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-lead"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCancel}
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleSave}
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value as LeadStatus })}
                >
                  <SelectTrigger id="edit-status" data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="prequalified">Pre-qualified</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-income">Income (optional)</Label>
                <Input
                  id="edit-income"
                  value={editForm.income}
                  onChange={(e) => setEditForm({ ...editForm, income: e.target.value })}
                  data-testid="input-edit-income"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-moveInDate">Move-in Date (optional)</Label>
                <Input
                  id="edit-moveInDate"
                  value={editForm.moveInDate}
                  onChange={(e) => setEditForm({ ...editForm, moveInDate: e.target.value })}
                  data-testid="input-edit-moveindate"
                />
              </div>
            </div>
          ) : (
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
          )}

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
