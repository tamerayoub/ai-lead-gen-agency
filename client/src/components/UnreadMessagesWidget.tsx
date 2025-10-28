import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, ChevronDown, Plus, Sparkles, Send } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, differenceInDays, parseISO } from "date-fns";
import { normalizeEmailSubject } from "@shared/emailUtils";

interface UnreadMessagesWidgetProps {
  onLeadClick: (leadId: string) => void;
}

const formatTimestamp = (timestamp: string) => {
  try {
    let date: Date;
    if (timestamp.includes('T') || timestamp.includes('Z')) {
      date = parseISO(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return timestamp;
    }

    const now = new Date();
    const daysDiff = differenceInDays(now, date);

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (daysDiff <= 7) {
      return format(date, "EEEE h:mm a");
    } else {
      return format(date, "MMM d, h:mm a");
    }
  } catch (error) {
    return timestamp;
  }
};

export function UnreadMessagesWidget({ onLeadClick }: UnreadMessagesWidgetProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadData, setSelectedLeadData] = useState<any>(null);
  
  // Message composer state
  const [newMessage, setNewMessage] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [threadOption, setThreadOption] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");
  
  // Track which specific lead/reply is pending
  const [pendingGenerateLeadId, setPendingGenerateLeadId] = useState<string | null>(null);
  const [pendingApproveReplyId, setPendingApproveReplyId] = useState<string | null>(null);
  
  // AI message preview dialog
  const [selectedAiMessage, setSelectedAiMessage] = useState<string | null>(null);
  
  // AI reply send dialog
  const [selectedAiReply, setSelectedAiReply] = useState<any>(null);
  
  const { toast } = useToast();

  const { data: unreadLeads = [], isLoading } = useQuery<Array<any>>({
    queryKey: ["/api/leads/unread"],
    refetchInterval: 30000,
  });

  // Fetch pending AI replies
  const { data: pendingReplies = [] } = useQuery<Array<any>>({
    queryKey: ["/api/pending-replies"],
    refetchInterval: 30000,
  });

  // Fetch lead details when dialog opens
  const { data: leadDetails } = useQuery({
    queryKey: ["/api/leads", selectedLeadId],
    enabled: !!selectedLeadId,
  });

  // Fetch available integrations
  const { data: gmailIntegration, isLoading: gmailLoading } = useQuery({
    queryKey: ["/api/integrations/gmail"],
    enabled: !!selectedLeadId,
  });

  const { data: outlookIntegration, isLoading: outlookLoading } = useQuery({
    queryKey: ["/api/integrations/outlook"],
    enabled: !!selectedLeadId,
  });

  const integrationsLoading = gmailLoading || outlookLoading;
  
  const availableIntegrations = integrationsLoading ? [] : [
    ...((gmailIntegration as any)?.metadata?.connected ? [{ id: "gmail", name: "Gmail" }] : []),
    ...((outlookIntegration as any)?.connected ? [{ id: "outlook", name: "Outlook" }] : []),
  ];

  // Extract unique email subjects from messages, filtered by selected integration
  // Normalize subjects to avoid duplicates like "Hi" and "Re: Hi"
  const existingSubjects = leadDetails?.conversations
    ?.filter((msg: any) => 
      msg.channel === 'email' && 
      msg.emailSubject && 
      msg.sourceIntegration === selectedIntegration
    )
    .map((msg: any) => msg.emailSubject!)
    .reduce((unique: string[], subject: string) => {
      const normalized = normalizeEmailSubject(subject);
      if (!unique.some(s => normalizeEmailSubject(s) === normalized)) {
        unique.push(subject);
      }
      return unique;
    }, []) || [];

  // Reset form when dialog closes
  useEffect(() => {
    if (!selectedLeadId && !selectedAiReply) {
      setNewMessage("");
      setSelectedIntegration("");
      setThreadOption("");
      setNewSubject("");
      setSelectedExistingSubject("");
    }
  }, [selectedLeadId, selectedAiReply]);

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

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, integration, emailSubject }: { message: string; integration: string; emailSubject: string }) => {
      return apiRequest("POST", "/api/conversations", {
        leadId: selectedLeadId,
        type: "outgoing",
        channel: "email",
        message,
        aiGenerated: false,
        sourceIntegration: integration,
        emailSubject,
      });
    },
    onSuccess: (data: any) => {
      // Always invalidate lead data to show the conversation update
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLeadId] });
      
      if (data.emailStatus?.sent) {
        // Only remove from unreplied list if email was successfully sent
        queryClient.invalidateQueries({ queryKey: ["/api/leads/unread"] });
        toast({
          title: "Message sent",
          description: "Your message has been sent successfully via email",
        });
        setSelectedLeadId(null);
      } else if (data.emailStatus?.error) {
        // Email failed to send - DON'T invalidate unread cache so lead stays visible
        toast({
          title: "Message saved but not sent",
          description: `Email failed to send: ${data.emailStatus.error}`,
          variant: "destructive",
        });
        // Don't close dialog so user can retry
      } else {
        toast({
          title: "Message saved",
          description: "Message saved to conversation history",
        });
        setSelectedLeadId(null);
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

  const generateAiReplyMutation = useMutation({
    mutationFn: async (leadId: string) => {
      setPendingGenerateLeadId(leadId);
      return apiRequest("POST", `/api/leads/${leadId}/ai-reply`);
    },
    onSuccess: () => {
      setPendingGenerateLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/leads/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
      toast({
        title: "AI reply generated",
        description: "AI reply has been generated and is ready for review",
      });
    },
    onError: () => {
      setPendingGenerateLeadId(null);
      toast({
        title: "Error",
        description: "Failed to generate AI reply",
        variant: "destructive",
      });
    },
  });


  const handleSendMessage = () => {
    const emailSubject = threadOption === "new" 
      ? newSubject 
      : (selectedExistingSubject || existingSubjects[0] || "Re: Property Inquiry");
    
    if (newMessage.trim() && selectedIntegration && threadOption) {
      const isValid = threadOption === "new" ? newSubject.trim() : true;
      if (isValid) {
        sendMessageMutation.mutate({ message: newMessage, integration: selectedIntegration, emailSubject });
      }
    }
  };

  const handleOpenSendDialog = (lead: any) => {
    setSelectedLeadId(lead.id);
    setSelectedLeadData(lead);
  };

  const handleOpenAiSendDialog = (lead: any, aiReply: any) => {
    setSelectedAiReply(aiReply);
    setSelectedLeadId(lead.id);
    setSelectedLeadData(lead);
    setNewMessage(aiReply.content); // Pre-fill with AI-generated content
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Unreplied Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (unreadLeads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Unreplied Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No unreplied messages</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Unreplied Messages
            <Badge 
              variant="destructive" 
              className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
              data-testid="unreplied-count-badge"
            >
              <Mail className="h-3 w-3" />
              {unreadLeads.reduce((total, lead) => total + (lead.unreadCount || 0), 0)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto p-6 space-y-2">
            {unreadLeads.map((lead) => {
              const messagePreview = lead.lastMessage?.substring(0, 100) || "No message preview";
              const timeAgo = lead.lastMessageAt 
                ? formatTimestamp(lead.lastMessageAt)
                : "";
              
              // Find AI response for this lead
              const aiResponse = pendingReplies.find((reply: any) => reply.leadId === lead.id);

              return (
                <div
                  key={lead.id}
                  className="border rounded-md"
                  data-testid={`unreplied-message-${lead.id}`}
                >
                  <div
                    className="flex items-start gap-3 p-3 hover-elevate cursor-pointer"
                    onClick={() => onLeadClick(lead.id)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback>
                        {lead.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate mb-1">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {lead.email || lead.phone}
                      </p>
                      <p className="text-xs text-foreground/70 italic line-clamp-2 border-l-2 border-muted pl-2">
                        "{messagePreview}"
                      </p>
                      {timeAgo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {timeAgo}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant="destructive" 
                      className="flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-0.5"
                      data-testid={`unreplied-badge-${lead.id}`}
                    >
                      <Mail className="h-3 w-3" />
                      {lead.unreadCount}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSendDialog(lead);
                      }}
                      data-testid={`button-expand-${lead.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* AI Response Preview Section */}
                  <div className="border-t bg-muted/20 p-3 space-y-2">
                    {aiResponse ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="text-xs font-medium">AI Response Ready</p>
                        </div>
                        <div 
                          className="bg-background/60 border rounded p-2 cursor-pointer hover-elevate"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAiMessage(aiResponse.content);
                          }}
                          data-testid={`ai-message-preview-${lead.id}`}
                        >
                          <p className="text-xs text-foreground/80 line-clamp-3">
                            {aiResponse.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 italic">Click to view full message</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAiSendDialog(lead, aiResponse);
                            }}
                            data-testid={`button-approve-ai-${lead.id}`}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Send AI Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateAiReplyMutation.mutate(lead.id);
                            }}
                            disabled={pendingGenerateLeadId === lead.id}
                            data-testid={`button-regenerate-ai-${lead.id}`}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Generate New
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSendDialog(lead);
                            }}
                            data-testid={`button-manual-${lead.id}`}
                          >
                            Send Manual
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">No AI response generated yet</p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateAiReplyMutation.mutate(lead.id);
                            }}
                            disabled={pendingGenerateLeadId === lead.id}
                            data-testid={`button-generate-ai-${lead.id}`}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Generate AI Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSendDialog(lead);
                            }}
                            data-testid={`button-manual-message-${lead.id}`}
                          >
                            Send Manual Message
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Send Message Dialog */}
      <Dialog open={!!selectedLeadId} onOpenChange={(open) => {
        if (!open) {
          setSelectedLeadId(null);
          setSelectedAiReply(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-send-message">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAiReply && <Sparkles className="h-5 w-5 text-primary" />}
              Send Message to {selectedLeadData?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedAiReply 
                ? "Review and send the AI-generated response using your integrated email account."
                : "Compose and send an email message to this lead using your integrated email account."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
                <div className="space-y-2">
                  <Label htmlFor="integration-select">Select Integration</Label>
                  <Select
                    value={selectedIntegration}
                    onValueChange={setSelectedIntegration}
                    disabled={sendMessageMutation.isPending}
                  >
                    <SelectTrigger id="integration-select" data-testid="select-integration">
                      <SelectValue placeholder="Choose integration..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIntegrations.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id}>
                          {integration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Thread Selection */}
                {selectedIntegration && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="thread-select">Email Thread</Label>
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
                        <SelectTrigger id="thread-select" data-testid="select-thread-option">
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
                    </div>

                    {/* Existing Subject Selector */}
                    {threadOption === "existing" && existingSubjects.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="subject-select">Select Subject</Label>
                        <Select
                          value={selectedExistingSubject}
                          onValueChange={setSelectedExistingSubject}
                          disabled={sendMessageMutation.isPending}
                        >
                          <SelectTrigger id="subject-select" data-testid="select-existing-subject">
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
                      </div>
                    )}

                    {/* New Subject Input */}
                    {threadOption === "new" && (
                      <div className="space-y-2">
                        <Label htmlFor="new-subject">Email Subject</Label>
                        <Input
                          id="new-subject"
                          placeholder="Enter email subject..."
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          disabled={sendMessageMutation.isPending}
                          data-testid="input-new-subject"
                        />
                      </div>
                    )}

                    {/* Message Input */}
                    <div className="space-y-2">
                      <Label htmlFor="message-input">Message</Label>
                      {selectedAiReply ? (
                        <div className="bg-muted/50 border rounded-md p-3 max-h-[200px] overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">{newMessage}</p>
                        </div>
                      ) : (
                        <Input
                          id="message-input"
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && newMessage.trim() && selectedIntegration && threadOption) {
                              const isValid = threadOption === "new" ? newSubject.trim() : true;
                              if (isValid) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }
                          }}
                          disabled={sendMessageMutation.isPending}
                          data-testid="input-reply-message"
                        />
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1"
                        onClick={handleSendMessage}
                        disabled={
                          sendMessageMutation.isPending || 
                          !newMessage.trim() || 
                          !selectedIntegration || 
                          !threadOption ||
                          (threadOption === "new" && !newSubject.trim())
                        }
                        data-testid="button-send-message"
                      >
                        {selectedAiReply && <Sparkles className="h-4 w-4 mr-2" />}
                        <Mail className="h-4 w-4 mr-2" />
                        {selectedAiReply ? "Send AI Reply" : "Send Message"}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Message Preview Dialog */}
      <Dialog open={!!selectedAiMessage} onOpenChange={(open) => !open && setSelectedAiMessage(null)}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-ai-message-preview">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Response
            </DialogTitle>
            <DialogDescription>
              Full preview of the AI-generated response
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 border rounded-md p-4 max-h-[400px] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{selectedAiMessage}</p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedAiMessage(null)}
                data-testid="button-close-preview"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
