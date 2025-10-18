import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MapPin, DollarSign, Calendar, Send, Edit2, X, Check, MoreVertical, Trash2, Plus, Sparkles } from "lucide-react";
import { LeadStatus } from "./LeadCard";
import { ConversationTimeline } from "./ConversationTimeline";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
    channel: "email" | "sms" | "phone" | "system";
    message: string;
    timestamp: string;
    aiGenerated?: boolean;
    emailSubject?: string;
    sourceIntegration?: string;
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "" as LeadStatus,
    income: "",
    moveInDate: "",
  });
  
  // Send message form state
  const [newMessage, setNewMessage] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [threadOption, setThreadOption] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");
  
  const conversationEndRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Fetch available integrations for messaging
  const { data: gmailIntegration, isLoading: gmailLoading } = useQuery({
    queryKey: ["/api/integrations/gmail"],
    enabled: open, // Only fetch when sheet is open
  });

  const { data: outlookIntegration, isLoading: outlookLoading } = useQuery({
    queryKey: ["/api/integrations/outlook"],
    enabled: open, // Only fetch when sheet is open
  });

  // Wait for both queries to finish loading before building the list
  const integrationsLoading = gmailLoading || outlookLoading;
  
  const availableIntegrations = integrationsLoading ? [] : [
    ...((gmailIntegration as any)?.metadata?.connected ? [{ id: "gmail", name: "Gmail" }] : []),
    ...((outlookIntegration as any)?.connected ? [{ id: "outlook", name: "Outlook" }] : []),
  ];

  // Extract unique email subjects from messages, filtered by selected integration
  const existingSubjects = lead?.conversations
    .filter(msg => 
      msg.channel === 'email' && 
      msg.emailSubject && 
      msg.sourceIntegration === selectedIntegration
    )
    .map(msg => msg.emailSubject!)
    .filter((subject, index, self) => self.indexOf(subject) === index) || [];

  // Reset thread/subject options when integration changes
  useEffect(() => {
    if (selectedIntegration) {
      setThreadOption("");
      setSelectedExistingSubject("");
      setNewSubject("");
    }
  }, [selectedIntegration]);

  // Set default thread option when integration is selected
  useEffect(() => {
    if (selectedIntegration && !threadOption) {
      setThreadOption(existingSubjects.length > 0 ? "existing" : "new");
    }
  }, [selectedIntegration, threadOption, existingSubjects.length]);

  // Set default existing subject when available
  useEffect(() => {
    if (existingSubjects.length > 0 && !selectedExistingSubject && threadOption === "existing") {
      setSelectedExistingSubject(existingSubjects[0]);
    }
  }, [existingSubjects, selectedExistingSubject, threadOption]);

  // Scroll to bottom of conversation when sheet opens or messages change
  useEffect(() => {
    if (open && conversationEndRef.current) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [open, lead?.conversations]);

  const updateLeadMutation = useMutation({
    mutationFn: async (data: Partial<typeof editForm>) => {
      const res = await apiRequest("PATCH", `/api/leads/${lead?.id}`, data);
      return await res.json();
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

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/leads/${lead?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead",
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

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, integration, emailSubject }: { message: string; integration: string; emailSubject: string }) => {
      return apiRequest("POST", "/api/conversations", {
        leadId: lead?.id,
        type: "outgoing",
        channel: "email",
        message,
        aiGenerated: false,
        sourceIntegration: integration,
        emailSubject,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id] });
      
      // Check if email was actually sent
      if (data.emailStatus?.sent) {
        toast({
          title: "Message sent",
          description: "Your message has been sent successfully via email",
        });
      } else if (data.emailStatus?.error) {
        // Email failed to send - show warning
        toast({
          title: "Message saved but not sent",
          description: `Email failed to send: ${data.emailStatus.error}`,
          variant: "destructive",
        });
      } else {
        // Saved as conversation but no email attempted
        toast({
          title: "Message saved",
          description: "Message saved to conversation history",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const aiReplyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/leads/${lead?.id}/ai-reply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
      toast({
        title: "AI reply generated",
        description: "AI reply has been generated and saved for review",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI reply",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async (message: string, integration: string, emailSubject: string) => {
    await sendMessageMutation.mutateAsync({ message, integration, emailSubject });
  };

  const retryMessageMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/retry`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id] });
      
      if (data.success) {
        toast({
          title: "Email sent",
          description: "The email has been sent successfully",
        });
      } else {
        toast({
          title: "Retry failed",
          description: data.error || "Failed to resend email",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to retry sending email",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id] });
      toast({
        title: "Message deleted",
        description: "The message has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  const handleAIReply = () => {
    aiReplyMutation.mutate();
  };

  const handleRetryMessage = (conversationId: string) => {
    retryMessageMutation.mutate(conversationId);
  };

  const handleDeleteMessage = (conversationId: string) => {
    deleteMessageMutation.mutate(conversationId);
  };

  if (!lead) return null;

  const initials = lead.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0" data-testid="sheet-lead-detail">
        <SheetHeader className="pb-6 px-6 pt-6 shrink-0">
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
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit-lead"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        data-testid="button-lead-actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        data-testid="menu-item-delete-lead"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
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

        {/* Fixed profile info section */}
        <div className="shrink-0 px-6 pb-3 border-b">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-name" className="text-xs">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    data-testid="input-edit-name"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-status" className="text-xs">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value as LeadStatus })}
                  >
                    <SelectTrigger id="edit-status" data-testid="select-edit-status" className="h-8">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-email" className="text-xs">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    data-testid="input-edit-email"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-phone" className="text-xs">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    data-testid="input-edit-phone"
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-income" className="text-xs">Income</Label>
                  <Input
                    id="edit-income"
                    value={editForm.income}
                    onChange={(e) => setEditForm({ ...editForm, income: e.target.value })}
                    data-testid="input-edit-income"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-moveInDate" className="text-xs">Move-in Date</Label>
                  <Input
                    id="edit-moveInDate"
                    value={editForm.moveInDate}
                    onChange={(e) => setEditForm({ ...editForm, moveInDate: e.target.value })}
                    data-testid="input-edit-moveindate"
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{lead.email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{lead.phone || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{lead.property || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">Income: {lead.income || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">Move-in: {lead.moveInDate || "N/A"}</span>
                </div>
              </div>
              {lead.qualificationScore !== undefined && (
                <div className="pt-1">
                  <div className="text-xs font-medium mb-1">Qualification Score</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${lead.qualificationScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold">{lead.qualificationScore}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrollable tabs area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="conversation" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full shrink-0 mx-6">
              <TabsTrigger value="conversation" className="flex-1" data-testid="tab-conversation">Conversation</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1" data-testid="tab-notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="conversation" className="flex-1 overflow-y-auto px-6 mt-4 min-h-0">
              <ConversationTimeline 
                messages={lead.conversations} 
                leadName={lead.name}
                onRetryMessage={handleRetryMessage}
                onDeleteMessage={handleDeleteMessage}
              />
              <div ref={conversationEndRef} />
            </TabsContent>
            <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 space-y-3 mt-4 min-h-0">
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
        </div>

        {/* Fixed footer with send message form and action buttons */}
        <div className="shrink-0 border-t px-6 py-4 space-y-4">
          {/* Send Message Form */}
          <div className="space-y-3">
            {integrationsLoading ? (
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="text-muted-foreground">Loading integrations...</p>
              </div>
            ) : availableIntegrations.length === 0 ? (
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium mb-1">No integrations set up</p>
                <p className="text-muted-foreground">
                  Please set up an integration (Gmail or Outlook) in the Integrations page to send messages.
                </p>
              </div>
            ) : (
              <>
                {/* Integration Selector */}
                <Select
                  value={selectedIntegration}
                  onValueChange={setSelectedIntegration}
                  disabled={sendMessageMutation.isPending}
                >
                  <SelectTrigger className="w-full" data-testid="select-integration">
                    <SelectValue placeholder="Select integration..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIntegrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Thread Selection - only show if integration is selected */}
                {selectedIntegration && (
                  <>
                    <div className="flex gap-2">
                      <Select
                        value={threadOption}
                        onValueChange={(value) => {
                          setThreadOption(value);
                          if (value === "new") {
                            setNewSubject("");
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                      >
                        <SelectTrigger className="flex-1" data-testid="select-thread-option">
                          <SelectValue placeholder="Choose thread..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existing">
                            {existingSubjects.length > 0 ? "Reply to existing thread" : "Use default thread"}
                          </SelectItem>
                          <SelectItem value="new">
                            <div className="flex items-center gap-1.5">
                              <Plus className="h-3 w-3" />
                              Create new thread
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Existing Subject Selector */}
                      {threadOption === "existing" && existingSubjects.length > 0 && (
                        <Select
                          value={selectedExistingSubject}
                          onValueChange={setSelectedExistingSubject}
                          disabled={sendMessageMutation.isPending}
                        >
                          <SelectTrigger className="flex-1" data-testid="select-existing-subject">
                            <SelectValue placeholder="Choose subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {existingSubjects.map((subject, index) => (
                              <SelectItem key={index} value={subject}>
                                {subject}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* New Subject Input */}
                      {threadOption === "new" && (
                        <Input
                          placeholder="Email subject..."
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          disabled={sendMessageMutation.isPending}
                          className="flex-1"
                          data-testid="input-new-subject"
                        />
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          const emailSubject = threadOption === "new" 
                            ? newSubject 
                            : (selectedExistingSubject || existingSubjects[0] || "Re: Property Inquiry");
                          
                          if (e.key === "Enter" && !e.shiftKey && newMessage.trim() && selectedIntegration && threadOption) {
                            const isValid = threadOption === "new" ? newSubject.trim() : true;
                            if (isValid) {
                              e.preventDefault();
                              handleSendMessage(newMessage, selectedIntegration, emailSubject);
                              setNewMessage("");
                              if (threadOption === "new") setNewSubject("");
                            }
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                        className="flex-1"
                        data-testid="input-reply-message"
                      />
                      <Button
                        onClick={() => {
                          const emailSubject = threadOption === "new" 
                            ? newSubject 
                            : (selectedExistingSubject || existingSubjects[0] || "Re: Property Inquiry");
                          
                          if (newMessage.trim() && selectedIntegration && threadOption) {
                            const isValid = threadOption === "new" ? newSubject.trim() : true;
                            if (isValid) {
                              handleSendMessage(newMessage, selectedIntegration, emailSubject);
                              setNewMessage("");
                              if (threadOption === "new") setNewSubject("");
                            }
                          }
                        }}
                        disabled={
                          sendMessageMutation.isPending || 
                          !newMessage.trim() || 
                          !selectedIntegration || 
                          !threadOption ||
                          (threadOption === "new" && !newSubject.trim())
                        }
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleAIReply}
                        disabled={aiReplyMutation.isPending}
                        data-testid="button-ai-reply"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-lead">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {lead.name}? This action cannot be undone.
              All conversations, notes, and data associated with this lead will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadMutation.mutate()}
              disabled={deleteLeadMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteLeadMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
