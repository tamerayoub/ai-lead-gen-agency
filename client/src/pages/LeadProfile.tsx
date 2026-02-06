import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MapPin, DollarSign, Calendar, Send, Edit2, X, Check, MoreVertical, Trash2, Plus, Sparkles, ArrowLeft, Maximize2, FileText, Activity, Clock, ListTodo, ExternalLink, Home, CreditCard, Shield, Facebook } from "lucide-react";
import { LeadStatus } from "@/components/LeadCard";
import { ConversationTimeline } from "@/components/ConversationTimeline";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { normalizeEmailSubject } from "@shared/emailUtils";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
    creditScore: "",
    criminalHistory: "",
    pets: "",
    cars: "",
    preferredBedrooms: "",
    preferredBathrooms: "",
    preferredSqFt: "",
  });
  
  // Send message form state
  const [newMessage, setNewMessage] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [threadOption, setThreadOption] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");
  
  // Notes state
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useQuery<any>({
    queryKey: ["/api/leads", leadId],
    enabled: !!leadId,
  });

  // Fetch showings for this lead
  const { data: showings = [], isLoading: showingsLoading } = useQuery<any[]>({
    queryKey: ["/api/showings/lead", leadId],
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
      const profileData = lead.profileData || {};
      setEditForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "new",
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
        creditScore: profileData.creditScore?.toString() || "",
        criminalHistory: profileData.criminalHistory?.toString() || "",
        pets: profileData.pets?.toString() || "",
        cars: profileData.cars?.toString() || "",
        preferredBedrooms: profileData.preferredBedrooms?.toString() || profileData.bedrooms?.toString() || "",
        preferredBathrooms: profileData.preferredBathrooms?.toString() || profileData.bathrooms?.toString() || "",
        preferredSqFt: profileData.preferredSqFt?.toString() || profileData.squareFeet?.toString() || "",
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
      const profileData = lead.profileData || {};
      setEditForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "new",
        income: lead.income || "",
        moveInDate: lead.moveInDate || "",
        creditScore: profileData.creditScore?.toString() || "",
        criminalHistory: profileData.criminalHistory?.toString() || "",
        pets: profileData.pets?.toString() || "",
        cars: profileData.cars?.toString() || "",
        preferredBedrooms: profileData.preferredBedrooms?.toString() || profileData.bedrooms?.toString() || "",
        preferredBathrooms: profileData.preferredBathrooms?.toString() || profileData.bathrooms?.toString() || "",
        preferredSqFt: profileData.preferredSqFt?.toString() || profileData.squareFeet?.toString() || "",
      });
      setIsEditing(false);
    }
  };

  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      // Build profileData object from form fields
      const profileData: any = {};
      if (editForm.creditScore) profileData.creditScore = parseInt(editForm.creditScore) || null;
      if (editForm.criminalHistory) profileData.criminalHistory = editForm.criminalHistory === "true" || editForm.criminalHistory === "yes";
      if (editForm.pets) profileData.pets = parseInt(editForm.pets) || editForm.pets;
      if (editForm.cars) profileData.cars = parseInt(editForm.cars) || editForm.cars;
      if (editForm.preferredBedrooms) profileData.preferredBedrooms = parseInt(editForm.preferredBedrooms) || null;
      if (editForm.preferredBathrooms) profileData.preferredBathrooms = parseInt(editForm.preferredBathrooms) || null;
      if (editForm.preferredSqFt) profileData.preferredSqFt = parseInt(editForm.preferredSqFt) || null;
      
      // Also set legacy fields for backward compatibility
      if (editForm.preferredBedrooms) profileData.bedrooms = parseInt(editForm.preferredBedrooms) || null;
      if (editForm.preferredBathrooms) profileData.bathrooms = parseInt(editForm.preferredBathrooms) || null;
      if (editForm.preferredSqFt) profileData.squareFeet = parseInt(editForm.preferredSqFt) || null;
      
      const updateData: any = {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        status: editForm.status,
        income: editForm.income || null,
        moveInDate: editForm.moveInDate || null,
      };
      
      // Only include profileData if there's data to save
      if (Object.keys(profileData).length > 0) {
        updateData.profileData = profileData;
      }
      
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, updateData);
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
      if (res.status === 204) return; // 204 No Content has empty body - do not parse JSON
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
      const res = await apiRequest("POST", `/api/leads/${leadId}/ai-reply`, {});
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate AI reply");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      // The endpoint returns { pendingReply: { content: ... } }
      if (data.pendingReply?.content) {
        setNewMessage(data.pendingReply.content);
        toast({
          title: "AI Reply Generated",
          description: "AI has generated a reply for you to review and send",
        });
        // Invalidate pending replies query to show the new draft
        queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
      } else if (data.message) {
        // If auto-sent or other status
        toast({
          title: "AI Reply Generated",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate AI reply",
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

  // Note mutations
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/notes", {
        leadId,
        content,
        aiGenerated: false,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create note");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      setNewNote("");
      setIsAddingNote(false);
      toast({
        title: "Note added",
        description: "Note has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("DELETE", `/api/notes/${noteId}`);
      if (!res.ok) {
        throw new Error("Failed to delete note");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      setNoteToDelete(null);
      toast({
        title: "Note deleted",
        description: "Note has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      return;
    }
    createNoteMutation.mutate(newNote.trim());
  };

  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      deleteNoteMutation.mutate(noteToDelete);
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

  // Build activity log items from conversations and notes
  const activityItems = [
    ...(lead.conversations || []).map((conv: any) => ({
      id: conv.id,
      type: conv.type === "received" ? "Message Received" : "Message Sent",
      timestamp: conv.createdAt || conv.timestamp,
      description: conv.message?.substring(0, 100) || "Message",
      channel: conv.channel,
    })),
    ...(lead.notes || []).map((note: any) => ({
      id: note.id,
      type: "Note Added",
      timestamp: note.createdAt || note.timestamp,
      description: note.content?.substring(0, 100) || "Note",
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get past showings
  const pastShowings = (showings || [])
    .filter((s: any) => {
      if (!s.scheduledDate) return false;
      return new Date(s.scheduledDate).getTime() < new Date().getTime();
    })
    .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  // Extract preferences from profileData
  const preferences = lead.profileData || {};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="border-b bg-card flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/leads")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leads
            </Button>
          </div>
          
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{isEditing ? editForm.name : lead.name}</h1>
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
                    variant="default"
                    size="sm"
                    onClick={() => setLocation("/ai/messages")}
                    data-testid="button-message-lead"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Message
                  </Button>
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
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {isEditing ? (
            <Card>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-2 gap-2">
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
                  
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-3">Additional Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-creditScore">Credit Score</Label>
                        <Input
                          id="edit-creditScore"
                          type="number"
                          value={editForm.creditScore}
                          onChange={(e) => setEditForm({ ...editForm, creditScore: e.target.value })}
                          placeholder="e.g., 650"
                          data-testid="input-edit-credit-score"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-criminalHistory">Criminal History</Label>
                        <Select
                          value={editForm.criminalHistory || "unspecified"}
                          onValueChange={(value) => setEditForm({ ...editForm, criminalHistory: value === "unspecified" ? "" : value })}
                        >
                          <SelectTrigger id="edit-criminalHistory" data-testid="select-edit-criminal-history">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unspecified">Not specified</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-pets">Pets</Label>
                        <Input
                          id="edit-pets"
                          type="number"
                          value={editForm.pets}
                          onChange={(e) => setEditForm({ ...editForm, pets: e.target.value })}
                          placeholder="Number of pets"
                          data-testid="input-edit-pets"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-cars">Cars</Label>
                        <Input
                          id="edit-cars"
                          type="number"
                          value={editForm.cars}
                          onChange={(e) => setEditForm({ ...editForm, cars: e.target.value })}
                          placeholder="Number of cars"
                          data-testid="input-edit-cars"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-3">Preferred Property Details</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-preferredBedrooms">Bedrooms</Label>
                        <Input
                          id="edit-preferredBedrooms"
                          type="number"
                          value={editForm.preferredBedrooms}
                          onChange={(e) => setEditForm({ ...editForm, preferredBedrooms: e.target.value })}
                          placeholder="e.g., 2"
                          data-testid="input-edit-preferred-bedrooms"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-preferredBathrooms">Bathrooms</Label>
                        <Input
                          id="edit-preferredBathrooms"
                          type="number"
                          value={editForm.preferredBathrooms}
                          onChange={(e) => setEditForm({ ...editForm, preferredBathrooms: e.target.value })}
                          placeholder="e.g., 1.5"
                          step="0.5"
                          data-testid="input-edit-preferred-bathrooms"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-preferredSqFt">Square Feet</Label>
                        <Input
                          id="edit-preferredSqFt"
                          type="number"
                          value={editForm.preferredSqFt}
                          onChange={(e) => setEditForm({ ...editForm, preferredSqFt: e.target.value })}
                          placeholder="e.g., 1200"
                          data-testid="input-edit-preferred-sqft"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Lead Profile & Preferences */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={() => setLocation("/ai/messages")}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setLocation(`/schedule?leadId=${leadId}`)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Book a Showing
                      </Button>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      {/* Contact Information */}
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Contact Information</h3>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.phone || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{lead.email || "N/A"}</span>
                          </div>
                          {(lead.source === 'facebook' || (lead.metadata as any)?.facebookProfileId || lead.externalId) && (
                            <div className="flex items-center gap-2 text-sm">
                              <Facebook className="h-4 w-4 text-muted-foreground" />
                              {(() => {
                                const profileId = (lead.metadata as any)?.facebookProfileId || lead.externalId;
                                if (!profileId) return <span>N/A</span>;
                                return (
                                  <a
                                    href={`https://www.facebook.com/profile.php?id=${profileId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    Facebook Profile
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Property Preferences */}
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold mb-2">Property Preferences</h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          {preferences?.propertyType ? (
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4" />
                              <span>Type: {preferences.propertyType}</span>
                            </div>
                          ) : null}
                          {(preferences?.preferredBedrooms || preferences?.bedrooms) && (
                            <div>Bedrooms: {preferences.preferredBedrooms || preferences.bedrooms}</div>
                          )}
                          {(preferences?.preferredBathrooms || preferences?.bathrooms) && (
                            <div>Bathrooms: {preferences.preferredBathrooms || preferences.bathrooms}</div>
                          )}
                          {(preferences?.preferredSqFt || preferences?.squareFeet) && (
                            <div>Square Feet: {preferences.preferredSqFt || preferences.squareFeet}</div>
                          )}
                          {preferences?.maxRent && (
                            <div>Max Rent: ${preferences.maxRent}</div>
                          )}
                          {!preferences?.propertyType && !preferences?.preferredBedrooms && !preferences?.bedrooms && !preferences?.preferredBathrooms && !preferences?.bathrooms && !preferences?.preferredSqFt && !preferences?.squareFeet && !preferences?.maxRent && (
                            <div className="text-sm text-muted-foreground">No preferences specified</div>
                          )}
                        </div>
                      </div>

                      {/* Profile Details */}
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold mb-2">Profile Details</h3>
                        <div className="space-y-2 text-sm">
                          {lead.income && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>Income: {lead.income}</span>
                            </div>
                          )}
                          {preferences?.creditScore && (
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span>Credit Score: {preferences.creditScore}</span>
                            </div>
                          )}
                          {preferences?.criminalHistory !== undefined && (
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>Criminal History: {preferences.criminalHistory ? "Yes" : "No"}</span>
                            </div>
                          )}
                          {preferences?.pets !== undefined && preferences.pets !== null && (
                            <div className="flex items-center gap-2">
                              <span>Pets: {preferences.pets}</span>
                            </div>
                          )}
                          {preferences?.cars !== undefined && preferences.cars !== null && (
                            <div className="flex items-center gap-2">
                              <span>Cars: {preferences.cars}</span>
                            </div>
                          )}
                          {lead.moveInDate && (
                            <div>Move-in Date: {lead.moveInDate}</div>
                          )}
                          {/* {lead.qualificationScore !== undefined && (
                            <div className="pt-2">
                              <div className="text-xs text-muted-foreground mb-1">Qualification Score</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${lead.qualificationScore}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold">{lead.qualificationScore}%</span>
                              </div>
                            </div>
                          )} */}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Listings & Showings */}
              <div className="lg:col-span-2 space-y-4">
                {/* Listings Inquired About */}
                {((lead.metadata as any)?.facebookListingId || (lead.conversations || []).some((c: any) => (c.metadata as any)?.facebookListingId)) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Listings Inquired About</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(() => {
                          const listingIds = new Set<string>();
                          if ((lead.metadata as any)?.facebookListingId) {
                            listingIds.add((lead.metadata as any).facebookListingId);
                          }
                          (lead.conversations || []).forEach((c: any) => {
                            if ((c.metadata as any)?.facebookListingId) {
                              listingIds.add((c.metadata as any).facebookListingId);
                            }
                          });
                          return Array.from(listingIds).map((listingId) => (
                            <div key={listingId} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm">{listingId}</span>
                              </div>
                              <a
                                href={`https://www.facebook.com/marketplace/item/${listingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                              >
                                View on Facebook
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ));
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Scheduled Showings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Scheduled Showings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {showings && showings.length > 0 ? (
                      <div className="space-y-3">
                        {showings
                          .filter((s: any) => {
                            if (!s.scheduledDate) return false;
                            return new Date(s.scheduledDate).getTime() >= new Date().getTime();
                          })
                          .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                          .map((showing: any) => (
                            <div key={showing.id} className="flex items-start gap-3 p-3 border rounded-md">
                              <Calendar className="h-5 w-5 text-primary mt-0.5" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {showing.scheduledDate 
                                    ? format(new Date(showing.scheduledDate), "PPP 'at' p")
                                    : "Date TBD"}
                                </div>
                                {showing.propertyName && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {showing.propertyName}
                                  </div>
                                )}
                                {showing.status && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    {showing.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        {showings.filter((s: any) => {
                          if (!s.scheduledDate) return false;
                          return new Date(s.scheduledDate).getTime() >= new Date().getTime();
                        }).length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No upcoming showings scheduled
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No showings scheduled
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Delete Note Dialog */}
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

