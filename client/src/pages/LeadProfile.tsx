import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MapPin, DollarSign, Calendar, Send, Edit2, X, Check, MoreVertical, Trash2, Plus, Sparkles, ArrowLeft, Maximize2 } from "lucide-react";
import { LeadStatus } from "@/components/LeadCard";
import { ConversationTimeline } from "@/components/ConversationTimeline";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { normalizeEmailSubject } from "@shared/emailUtils";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusColors: Record<LeadStatus, string> = {
  new: "bg-status-new text-white",
  contacted: "bg-status-contacted text-white",
  prequalified: "bg-status-prequalified text-white",
  application: "bg-status-application text-white",
  approved: "bg-status-approved text-white",
};

export default function LeadProfile() {
  const params = useParams<{ leadId: string }>();
  const [, setLocation] = useLocation();
  const leadId = params.leadId;

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
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useQuery<any>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  // Fetch available integrations for messaging
  const { data: gmailIntegration, isLoading: gmailLoading } = useQuery({
    queryKey: ["/api/integrations/gmail"],
    enabled: !!leadId,
  });

  const { data: outlookIntegration, isLoading: outlookLoading } = useQuery({
    queryKey: ["/api/integrations/outlook"],
    enabled: !!leadId,
  });

  // Wait for both queries to finish loading before building the list
  const integrationsLoading = gmailLoading || outlookLoading;
  
  const availableIntegrations = integrationsLoading ? [] : [
    ...((gmailIntegration as any)?.metadata?.connected ? [{ id: "gmail", name: "Gmail" }] : []),
    ...((outlookIntegration as any)?.connected ? [{ id: "outlook", name: "Outlook" }] : []),
  ];

  // Extract existing email subjects from conversations
  const existingSubjects = lead?.conversations
    ?.filter((c: any) => c.emailSubject && c.channel === "email")
    .map((c: any) => normalizeEmailSubject(c.emailSubject))
    .filter((subject: string, index: number, self: string[]) => self.indexOf(subject) === index) || [];

  // Initialize form when lead data loads
  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "new",
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
      });
    }
  }, [lead, isEditing]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationEndRef.current && conversationScrollRef.current) {
      conversationScrollRef.current.scrollTo({
        top: conversationScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [lead?.conversations]);

  const resetToServerData = () => {
    if (lead) {
      setEditForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "new",
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
      });
      setIsEditing(false);
    }
  };

  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, editForm);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      setIsEditing(false);
      toast({
        title: "Lead updated",
        description: "Lead information has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/leads/${leadId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead deleted",
        description: "Lead has been deleted successfully",
      });
      setLocation("/leads");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateLeadMutation.mutate();
  };

  const handleCancel = () => {
    resetToServerData();
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, integration, emailSubject }: { message: string; integration: string; emailSubject: string }) => {
      return apiRequest("POST", "/api/conversations", {
        leadId: leadId,
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
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      
      if (data.emailStatus?.sent) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads/unread"] });
        toast({
          title: "Message sent",
          description: "Your message has been sent successfully via email",
        });
      } else if (data.emailStatus?.error) {
        toast({
          title: "Message saved but not sent",
          description: `Email failed to send: ${data.emailStatus.error}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Message saved",
          description: "Message saved to conversation history",
        });
      }
      setNewMessage("");
      if (threadOption === "new") setNewSubject("");
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
      const res = await apiRequest("POST", "/api/ai/generate-reply", {
        leadId: leadId,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.reply) {
        setNewMessage(data.reply);
        toast({
          title: "AI Reply Generated",
          description: "AI has generated a reply for you to review and send",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI reply",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (message: string, integration: string, emailSubject: string) => {
    sendMessageMutation.mutate({ message, integration, emailSubject });
  };

  const handleRetryMessage = async (messageId: string) => {
    // Implementation for retrying failed messages
    toast({
      title: "Retry message",
      description: "This feature is coming soon",
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await apiRequest("DELETE", `/api/conversations/${messageId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({
        title: "Message deleted",
        description: "Message has been deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const handleAIReply = () => {
    aiReplyMutation.mutate();
  };

  if (leadLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading lead profile...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Lead not found</p>
          <Button onClick={() => setLocation("/leads")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  const initials = lead.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "?";

  // Transform lead data to match LeadDetailSheet format
  const leadDetails = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    property: lead.propertyName || lead.property || "N/A",
    status: lead.status,
    income: lead.income,
    moveInDate: lead.moveInDate,
    qualificationScore: lead.qualificationScore,
    conversations: lead.conversations?.map((c: any) => ({
      ...c,
      timestamp: c.createdAt || c.timestamp,
    })) || [],
    notes: lead.notes?.map((n: any) => ({
      ...n,
      timestamp: n.createdAt || n.timestamp,
    })) || [],
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/leads")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          </div>
          
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{isEditing ? editForm.name : lead.name}</h1>
                <Badge className={cn(statusColors[isEditing ? editForm.status : lead.status])}>
                  {(isEditing ? editForm.status : lead.status).charAt(0).toUpperCase() + (isEditing ? editForm.status : lead.status).slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  <span>{lead.email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  <span>{lead.phone || "N/A"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{leadDetails.property}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit-lead"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
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
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Profile Info Section */}
          <div className="mt-6">
            {isEditing ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-income">Income</Label>
                        <Input
                          id="edit-income"
                          value={editForm.income}
                          onChange={(e) => setEditForm({ ...editForm, income: e.target.value })}
                          data-testid="input-edit-income"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-moveInDate">Move-in Date</Label>
                        <Input
                          id="edit-moveInDate"
                          value={editForm.moveInDate}
                          onChange={(e) => setEditForm({ ...editForm, moveInDate: e.target.value })}
                          data-testid="input-edit-moveindate"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Email</div>
                      <div className="text-sm">{lead.email || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Phone</div>
                      <div className="text-sm">{lead.phone || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Property</div>
                      <div className="text-sm">{leadDetails.property}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Income</div>
                      <div className="text-sm">{lead.income || "N/A"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Move-in Date</div>
                      <div className="text-sm">{lead.moveInDate || "N/A"}</div>
                    </div>
                    {lead.qualificationScore !== undefined && (
                      <div className="space-y-1 col-span-2">
                        <div className="text-sm font-medium text-muted-foreground">Qualification Score</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${lead.qualificationScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{lead.qualificationScore}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
          <Tabs defaultValue="conversation" className="flex-1 flex flex-col min-h-0 h-full">
            <div className="px-6 pt-4 shrink-0">
              <TabsList>
                <TabsTrigger value="conversation" className="flex-1" data-testid="tab-conversation">Conversation</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1" data-testid="tab-notes">Notes</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent 
              value="conversation" 
              className="flex-1 overflow-y-auto px-6 mt-4 min-h-0"
              ref={conversationScrollRef}
            >
              <ConversationTimeline 
                messages={leadDetails.conversations} 
                leadName={lead.name}
                onRetryMessage={handleRetryMessage}
                onDeleteMessage={handleDeleteMessage}
              />
              <div ref={conversationEndRef} />
            </TabsContent>
            <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 space-y-3 mt-4 min-h-0">
              {leadDetails.notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{note.timestamp}</span>
                      {note.aiGenerated && (
                        <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                      )}
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* Fixed footer with send message form */}
          <div className="shrink-0 border-t px-6 py-4 space-y-4 bg-card">
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

                  {/* Thread Selection */}
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
                          <Send className="h-4 w-4 mr-2" />
                          Send
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
        </div>
      </div>

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
    </div>
  );
}

