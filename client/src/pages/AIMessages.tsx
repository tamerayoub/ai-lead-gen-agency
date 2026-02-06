import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Phone, Facebook, Send, Bot, Edit2, RefreshCw, Check, X, Sparkles, MoreVertical, Trash2, Loader2, Plus, ExternalLink, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { normalizeEmailSubject } from "@shared/emailUtils";
import { useLocation } from "wouter";

// Helper function to strip HTML tags and decode entities
function stripHtmlAndDecode(text: string): string {
  if (!text) return "";
  
  let plainText = text;
  
  // Strip HTML tags
  plainText = plainText.replace(/<[^>]*>/g, "");
  
  // Decode HTML entities
  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  
  // Replace named entities
  Object.entries(entityMap).forEach(([entity, char]) => {
    plainText = plainText.replace(new RegExp(entity, "g"), char);
  });
  
  // Replace numeric entities (e.g., &#039;)
  plainText = plainText.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  // Replace hex entities (e.g., &#x27;)
  plainText = plainText.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Clean up whitespace
  plainText = plainText.replace(/\s+/g, " ").trim();
  
  return plainText;
}

interface InboxItem {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    source: string;
    propertyName: string | null;
    createdAt: string;
    lastContactAt: string;
    metadata: any;
  };
  unreadCount: number;
  lastMessage: {
    id: string;
    type: string;
    channel: string;
    message: string;
    aiGenerated: boolean;
    createdAt: string;
    emailSubject: string | null;
    sourceIntegration: string | null;
  };
  needsReply?: boolean; // Whether the last message is from the lead and needs a reply
}

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  gmail: Mail,
  outlook: Mail,
  messenger: Facebook,
  facebook: Facebook,
  sms: Phone,
  phone: Phone,
};

function MessageBubble({ conv }: { conv: any }) {
  const isReceived = conv.type === "received" || conv.type === "incoming";
  const ChannelIcon = channelIcons[conv.channel] || MessageSquare;
  
  return (
    <div className={`flex gap-2 ${isReceived ? "justify-start" : "justify-end"} mb-3`}>
      {isReceived && (
        <Avatar className="h-6 w-6 mt-1 flex-shrink-0">
          <AvatarFallback className="text-xs">
            <ChannelIcon className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col max-w-[35%] ${isReceived ? "items-start" : "items-end"}`}>
        <div
          className={`rounded-2xl px-3 py-2 break-words overflow-wrap-anywhere ${
            isReceived
              ? "bg-muted text-foreground rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words break-all leading-relaxed word-wrap overflow-wrap-anywhere">
            {(() => {
              // URL regex that matches http/https URLs, excluding trailing punctuation
              const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+?)(?=[.,!?;:)]|\s|$)/gi;
              const parts: (string | JSX.Element)[] = [];
              let lastIndex = 0;
              let match;
              
              // Reset regex lastIndex
              urlRegex.lastIndex = 0;
              
              while ((match = urlRegex.exec(conv.message)) !== null) {
                // Add text before the URL
                if (match.index > lastIndex) {
                  parts.push(conv.message.substring(lastIndex, match.index));
                }
                
                // Add the URL as a clickable link
                const url = match[1];
                parts.push(
                  <a
                    key={`url-${match.index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-400 hover:text-blue-300 break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {url}
                  </a>
                );
                
                lastIndex = match.index + match[0].length;
              }
              
              // Add remaining text after last URL
              if (lastIndex < conv.message.length) {
                parts.push(conv.message.substring(lastIndex));
              }
              
              // If no URLs found, return original message
              return parts.length > 0 ? parts : conv.message;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-1 mt-1 px-1">
          {conv.aiGenerated && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              <Bot className="h-2.5 w-2.5 mr-1" />
              AI
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {(() => {
              try {
                const dateStr = conv.createdAt;
                // ParseISO handles ISO strings with 'Z' (UTC) correctly and converts to local time
                const date = parseISO(dateStr);
                
                // Verify the date is valid
                if (isNaN(date.getTime())) {
                  // Fallback: try creating a new Date if parseISO fails
                  const fallbackDate = new Date(dateStr);
                  if (isNaN(fallbackDate.getTime())) {
                    return dateStr;
                  }
                  return format(fallbackDate, "h:mm a");
                }
                
                // Format in user's local timezone (parseISO already converts UTC to local)
                return format(date, "h:mm a");
              } catch (error) {
                // Fallback to original string if parsing fails
                return conv.createdAt;
              }
            })()}
          </span>
        </div>
      </div>
      {!isReceived && (
        <Avatar className="h-6 w-6 mt-1 flex-shrink-0">
          <AvatarFallback className="text-xs bg-blue-500 text-white">
            You
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

interface PendingReply {
  id: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  subject: string;
  content: string;
  originalMessage?: string;
  channel: string;
  status: string;
  createdAt: string;
  metadata?: any;
}

function ChatView({ leadId, leadName, onBack }: { leadId: string; leadName: string; onBack?: () => void }) {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [threadOption, setThreadOption] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Fetch lead metadata for Facebook messages (only when leadId exists)
  const { data: leadData } = useQuery({
    queryKey: [`/api/leads/${leadId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/leads/${leadId}`);
      return await response.json();
    },
    enabled: !!leadId, // Only fetch when leadId is available
  });
  
  // Extract Facebook metadata from lead
  const leadMetadata = leadData?.metadata ? {
    facebookListingId: leadData.metadata.facebookListingId,
    facebookProfileName: leadData.metadata.facebookProfileName,
    facebookProfileId: leadData.metadata.facebookProfileId,
    facebookConversationId: leadData.metadata.facebookConversationId,
  } : null;
  
  // Use Facebook profile name if available, otherwise use the passed leadName
  const displayLeadName = leadMetadata?.facebookProfileName || leadName;
  
  const handleLeadProfileClick = () => {
    setLocation(`/leads/${leadId}`);
  };
  
  // Co-Pilot Mode: Pending AI replies
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regeneratingReplyId, setRegeneratingReplyId] = useState<string | null>(null);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const [selectedReplyIntegration, setSelectedReplyIntegration] = useState<string>("");
  
  // Delete conversation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: [`/api/conversations/${leadId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/conversations/${leadId}`);
      const data = await response.json();
      // Sort messages by createdAt in ascending order (oldest first)
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        // Debug: Log Facebook messages
        const facebookMessages = sorted.filter((c: any) => c.channel === 'facebook');
        if (facebookMessages.length > 0) {
          console.log('[ChatView] Facebook messages found:', facebookMessages.length, facebookMessages);
        }
        return sorted;
      }
      return data;
    },
    refetchInterval: 5000,
  });

  // Get available integrations
  const { data: gmailIntegration, isLoading: gmailLoading } = useQuery({
    queryKey: ["/api/integrations/gmail"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/integrations/gmail");
      return await response.json();
    },
  });

  const { data: outlookIntegration, isLoading: outlookLoading } = useQuery({
    queryKey: ["/api/integrations/outlook"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/integrations/outlook");
      return await response.json();
    },
  });

  // Gmail returns { metadata: { connected: true } } from /api/integrations/gmail
  // Outlook returns { connected: true } from /api/integrations/outlook
  const isGmailConnected = Boolean(
    gmailIntegration && 
    (gmailIntegration.metadata?.connected === true || gmailIntegration.connected === true) && 
    gmailIntegration.isActive !== false
  );

  const isOutlookConnected = Boolean(
    outlookIntegration && 
    outlookIntegration.connected === true && 
    outlookIntegration.isActive !== false
  );

  // Check if this is a Facebook lead
  const isFacebookLead = conversations?.some((conv: any) => conv.channel === 'facebook') || 
                         leadData?.source === 'facebook';

  const availableIntegrations = [
    ...(isGmailConnected ? [{ value: "gmail", label: "Gmail" }] : []),
    ...(isOutlookConnected ? [{ value: "outlook", label: "Outlook" }] : []),
    ...(isFacebookLead ? [{ value: "facebook", label: "Facebook" }] : []),
  ];

  useEffect(() => {
    // Auto-select integration
    if (isFacebookLead && !selectedIntegration) {
      setSelectedIntegration('facebook');
    } else if (availableIntegrations.length > 0 && !selectedIntegration) {
      setSelectedIntegration(availableIntegrations[0].value);
    }
    if (availableIntegrations.length > 0 && !selectedReplyIntegration) {
      setSelectedReplyIntegration(availableIntegrations[0].value);
    }
  }, [availableIntegrations, selectedIntegration, selectedReplyIntegration, isFacebookLead]);

  // Extract unique email subjects from conversations, filtered by selected integration
  const existingSubjects = conversations
    ?.filter((conv: any) => 
      conv.channel === 'email' && 
      conv.emailSubject && 
      conv.sourceIntegration === selectedIntegration
    )
    .map((conv: any) => normalizeEmailSubject(conv.emailSubject))
    .filter((subject: string, index: number, self: string[]) => self.indexOf(subject) === index) || [];

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

  // Fetch pending AI replies for this lead (Co-Pilot Mode)
  const { data: pendingReplies = [] } = useQuery<PendingReply[]>({
    queryKey: ["/api/pending-replies", leadId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/pending-replies");
      const allReplies = await response.json();
      return allReplies.filter((reply: PendingReply) => reply.leadId === leadId && reply.status === "pending");
    },
    refetchInterval: 5000,
  });


  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, integration, emailSubject }: { message: string; integration: string; emailSubject?: string }) => {
      // Determine channel based on integration
      const channel = integration === 'facebook' ? 'facebook' : 'email';
      
      return apiRequest("POST", "/api/conversations", {
        leadId,
        type: "outgoing",
        channel,
        message,
        sourceIntegration: integration,
        ...(emailSubject && { emailSubject }),
        aiGenerated: false,
      });
    },
    onSuccess: () => {
      setMessage("");
      if (threadOption === "new") setNewSubject("");
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${leadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    // For Facebook, no email subject needed
    if (selectedIntegration === 'facebook') {
      if (message.trim()) {
        sendMessageMutation.mutate({ message: message.trim(), integration: selectedIntegration });
      }
    } else {
      // For email, require subject
      const emailSubject = threadOption === "new" 
        ? newSubject 
        : (selectedExistingSubject || existingSubjects[0] || "Re: Property Inquiry");
      
      if (message.trim() && selectedIntegration && threadOption) {
        const isValid = threadOption === "new" ? newSubject.trim() : true;
        if (isValid) {
          sendMessageMutation.mutate({ message: message.trim(), integration: selectedIntegration, emailSubject });
        }
      }
    }
  };

  // AI Reply generation mutation
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
        setMessage(data.pendingReply.content);
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
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${leadId}`] });
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

  const handleAIReply = () => {
    aiReplyMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Co-Pilot Mode: Approve pending reply
  const approveMutation = useMutation({
    mutationFn: ({ replyId, integration }: { replyId: string; integration: string }) => 
      apiRequest("PATCH", `/api/pending-replies/${replyId}/approve`, { integration }),
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "AI reply has been sent successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${leadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Co-Pilot Mode: Edit pending reply
  const editMutation = useMutation({
    mutationFn: ({ replyId, content }: { replyId: string; content: string }) =>
      apiRequest("PATCH", `/api/pending-replies/${replyId}`, { content }),
    onSuccess: () => {
      toast({
        title: "Reply updated",
        description: "Your edits have been saved",
      });
      setEditingReplyId(null);
      setEditedContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update reply",
        variant: "destructive",
      });
    },
  });

  // Co-Pilot Mode: Regenerate with feedback
  const regenerateMutation = useMutation({
    mutationFn: async ({ replyId, feedback }: { replyId: string; feedback: string }) => {
      const response = await apiRequest("POST", `/api/pending-replies/${replyId}/regenerate`, { feedback });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reply regenerated",
        description: "AI has generated a new version based on your feedback",
      });
      setRegenerateDialogOpen(false);
      setRegeneratingReplyId(null);
      setRegenerateFeedback("");
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
    },
    onError: (error: any) => {
      console.error("Regenerate error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to regenerate reply",
        variant: "destructive",
      });
      setRegenerateDialogOpen(false);
      setRegeneratingReplyId(null);
    },
  });

  // Co-Pilot Mode: Delete/reject pending reply
  const rejectMutation = useMutation({
    mutationFn: (replyId: string) => apiRequest("DELETE", `/api/pending-replies/${replyId}`, {}),
    onSuccess: () => {
      toast({
        title: "Reply rejected",
        description: "The pending reply has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies", leadId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject reply",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (reply: PendingReply) => {
    setEditingReplyId(reply.id);
    setEditedContent(reply.content);
  };

  const handleSaveEdit = () => {
    if (editingReplyId && editedContent.trim()) {
      editMutation.mutate({ replyId: editingReplyId, content: editedContent.trim() });
    }
  };

  const handleRegenerate = (reply: PendingReply) => {
    setRegeneratingReplyId(reply.id);
    setRegenerateDialogOpen(true);
    setRegenerateFeedback("");
  };

  const handleConfirmRegenerate = () => {
    if (regeneratingReplyId) {
      regenerateMutation.mutate({ replyId: regeneratingReplyId, feedback: regenerateFeedback });
    }
  };

  // Delete all conversations for this lead
  const deleteConversationMutation = useMutation({
    mutationFn: async () => {
      // Delete all conversations for this lead
      const conversationsToDelete = conversations || [];
      await Promise.all(
        conversationsToDelete.map((conv: any) =>
          apiRequest("DELETE", `/api/conversations/${conv.id}`, {})
        )
      );
    },
    onSuccess: () => {
      toast({
        title: "Conversation deleted",
        description: "All messages in this conversation have been deleted",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${leadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, pendingReplies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-full">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-background flex-shrink-0 z-10">
        <div className="flex items-center justify-between gap-3">
          {/* Mobile Back Button */}
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden flex-shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLeadProfileClick}
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback>
                {displayLeadName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm truncate">{displayLeadName}</h2>
                {/* Facebook Profile Link */}
                {(() => {
                  const profileId = leadMetadata?.facebookProfileId || leadData?.externalId;
                  if (profileId && (leadData?.source === 'facebook' || leadMetadata?.facebookProfileId)) {
                    return (
                      <a
                        href={`https://www.facebook.com/profile.php?id=${profileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                        title="View Facebook Profile"
                      >
                        <Facebook className="h-4 w-4" />
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>
              <p className="text-xs text-gray-500">
                {leadMetadata?.facebookListingId ? (
                  <>Facebook Listing: {leadMetadata.facebookListingId}</>
                ) : (
                  'Active now'
                )}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <ScrollArea className="h-full w-full">
          <div className="px-2 py-4 space-y-1 w-full overflow-x-hidden">
            {conversations && conversations.length > 0 ? (
              <>
                {/* Show Facebook info header if we have Facebook messages */}
                {conversations.some((conv: any) => conv.channel === 'facebook') && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 border mb-4">
                    <div className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Facebook Marketplace Conversation</span>
                    </div>
                    {leadMetadata?.facebookProfileName && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Lead:</span>{" "}
                        {(() => {
                          const profileId = leadMetadata?.facebookProfileId || leadData?.externalId;
                          if (profileId && (leadData?.source === 'facebook' || leadMetadata?.facebookProfileId)) {
                            return (
                              <a
                                href={`https://www.facebook.com/profile.php?id=${profileId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium"
                              >
                                {leadMetadata.facebookProfileName}
                              </a>
                            );
                          }
                          return <span>{leadMetadata.facebookProfileName}</span>;
                        })()}
                      </div>
                    )}
                    {leadMetadata?.facebookListingId && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Listing:</span>{" "}
                        <a 
                          href={`https://www.facebook.com/marketplace/item/${leadMetadata.facebookListingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View on Facebook
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {conversations.map((conv: any) => (
                  <MessageBubble key={conv.id} conv={conv} />
                ))}
              </>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                No messages yet. Start the conversation!
              </div>
            )}
            
            {/* Co-Pilot Mode: Pending AI Replies */}
            {pendingReplies.length > 0 && (
              <div className="space-y-3 mt-4 pt-4 border-t">
                <div className="text-xs font-semibold text-muted-foreground px-2 mb-2">
                  AI Drafts (Pending Approval)
                </div>
                {pendingReplies.map((reply) => (
                  <PendingReplyCard
                    key={reply.id}
                    reply={reply}
                    isEditing={editingReplyId === reply.id}
                    editedContent={editedContent}
                    onEdit={() => handleEdit(reply)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => {
                      setEditingReplyId(null);
                      setEditedContent("");
                    }}
                    onContentChange={setEditedContent}
                    onRegenerate={() => handleRegenerate(reply)}
                    onApprove={() => approveMutation.mutate({ replyId: reply.id, integration: selectedReplyIntegration })}
                    onReject={() => rejectMutation.mutate(reply.id)}
                    isApproving={approveMutation.isPending}
                    isEditingPending={editMutation.isPending}
                    availableIntegrations={availableIntegrations}
                    selectedIntegration={selectedReplyIntegration}
                    onIntegrationChange={setSelectedReplyIntegration}
                  />
                ))}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t px-4 py-3 bg-background flex-shrink-0 space-y-3">
        {gmailLoading || outlookLoading ? (
          <div className="text-sm text-muted-foreground text-center py-2">
            Loading integrations...
          </div>
        ) : availableIntegrations.length > 0 || isFacebookLead ? (
          <>
            {/* Integration Selector - Only show for email integrations */}
            {!isFacebookLead && (
              <Select
                value={selectedIntegration}
                onValueChange={setSelectedIntegration}
                disabled={sendMessageMutation.isPending}
              >
                <SelectTrigger className="w-full" data-testid="select-integration">
                  <SelectValue placeholder="Select integration..." />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.filter(int => int.value !== 'facebook').map((int) => (
                    <SelectItem key={int.value} value={int.value}>
                      {int.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Thread Selection - Only for email */}
            {selectedIntegration && selectedIntegration !== 'facebook' && (
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
                        {existingSubjects.map((subject: string, index: number) => (
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
              </>
            )}

            {/* Message Input */}
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isFacebookLead ? "Type your message..." : "Type your message..."}
                className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl border-gray-300 focus:border-blue-500"
                disabled={sendMessageMutation.isPending || aiReplyMutation.isPending}
                rows={1}
                data-testid="input-reply-message"
              />
              <Button
                onClick={handleSend}
                disabled={
                  sendMessageMutation.isPending || 
                  !message.trim() || 
                  (isFacebookLead ? false : (!selectedIntegration || !threadOption || (threadOption === "new" && !newSubject.trim())))
                }
                className="rounded-full h-11 w-11 p-0 flex-shrink-0"
                size="sm"
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleAIReply}
                disabled={aiReplyMutation.isPending}
                className="rounded-full h-11 w-11 p-0 flex-shrink-0"
                size="sm"
                data-testid="button-ai-reply"
                title="Generate AI reply"
              >
                {aiReplyMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2">
            Connect Gmail or Outlook to send messages
          </div>
        )}
      </div>

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate AI Reply</DialogTitle>
            <DialogDescription>
              Provide feedback to help AI improve the response (e.g., "shorter", "more friendly", "add pricing details")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (optional)</Label>
              <Input
                id="feedback"
                placeholder="e.g., shorter, more friendly, add pricing details"
                value={regenerateFeedback}
                onChange={(e) => setRegenerateFeedback(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegenerateDialogOpen(false);
                setRegeneratingReplyId(null);
                setRegenerateFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRegenerate}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entire conversation? This will permanently delete all messages with {leadName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConversationMutation.mutate()}
              disabled={deleteConversationMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConversationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Co-Pilot Mode: Pending Reply Card Component
function PendingReplyCard({
  reply,
  isEditing,
  editedContent,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onContentChange,
  onRegenerate,
  onApprove,
  onReject,
  isApproving,
  isEditingPending,
  availableIntegrations,
  selectedIntegration,
  onIntegrationChange,
}: {
  reply: PendingReply;
  isEditing: boolean;
  editedContent: string;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onContentChange: (content: string) => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isEditingPending: boolean;
  availableIntegrations: Array<{ value: string; label: string }>;
  selectedIntegration: string;
  onIntegrationChange: (integration: string) => void;
}) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-semibold text-blue-900">AI Draft</span>
        <Badge variant="secondary" className="text-[10px]">
          Pending Approval
        </Badge>
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editedContent}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[100px] text-sm"
            disabled={isEditingPending}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSaveEdit}
              disabled={isEditingPending || !editedContent.trim()}
            >
              {isEditingPending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
              disabled={isEditingPending}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-background rounded-md p-3 border border-blue-100 dark:border-blue-800">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{reply.content}</p>
          </div>
          {availableIntegrations.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor={`integration-select-${reply.id}`} className="text-xs">Send via:</Label>
              <Select
                value={selectedIntegration}
                onValueChange={onIntegrationChange}
                disabled={isApproving}
              >
                <SelectTrigger id={`integration-select-${reply.id}`} className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((int) => (
                    <SelectItem key={int.value} value={int.value}>
                      {int.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={onApprove}
              disabled={isApproving || !selectedIntegration}
              className="flex-1 min-w-[100px]"
            >
              {isApproving ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Approve & Send
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={isApproving}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={isApproving}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onReject}
              disabled={isApproving}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AIMessages() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState<string>("");
  const [deleteInboxDialogOpen, setDeleteInboxDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  const { data: inboxItems, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/messages/inbox"],
    queryFn: async () => {
      const startTime = performance.now();
      const response = await apiRequest("GET", "/api/messages/inbox?limit=25");
      const data = await response.json();
      const loadTime = performance.now() - startTime;
      
      if (loadTime > 1000) {
        console.warn(`[AIMessages] Slow inbox load: ${loadTime.toFixed(0)}ms`);
      }
      
      // Debug: Log Facebook leads
      const facebookLeads = data.filter((item: InboxItem) => 
        item.lead.source === 'facebook' || item.lastMessage.channel === 'facebook'
      );
      if (facebookLeads.length > 0) {
        console.log('[AIMessages] Facebook leads in inbox:', facebookLeads.length, facebookLeads);
      }
      
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds (reduced from 10s)
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  const handleSelectLead = (leadId: string, leadName: string) => {
    setSelectedLeadId(leadId);
    setSelectedLeadName(leadName);
  };

  // Delete conversation from inbox
  const deleteInboxConversationMutation = useMutation({
    mutationFn: async (leadId: string) => {
      // Get all conversations for this lead and delete them
      const response = await apiRequest("GET", `/api/conversations/${leadId}`);
      const conversations = await response.json();
      await Promise.all(
        conversations.map((conv: any) =>
          apiRequest("DELETE", `/api/conversations/${conv.id}`, {})
        )
      );
    },
    onSuccess: () => {
      toast({
        title: "Conversation deleted",
        description: "All messages in this conversation have been deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      if (selectedLeadId === leadToDelete?.id) {
        setSelectedLeadId(null);
        setSelectedLeadName("");
      }
      setDeleteInboxDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  const handleDeleteInboxConversation = (e: React.MouseEvent, leadId: string, leadName: string) => {
    e.stopPropagation(); // Prevent selecting the lead
    setLeadToDelete({ id: leadId, name: leadName });
    setDeleteInboxDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (!inboxItems || inboxItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No messages yet</p>
        </div>
      </div>
    );
  }

  // Determine which messages need replies (last message is incoming/received)
  const inboxItemsWithNeedsReply = inboxItems.map((item) => ({
    ...item,
    needsReply: item.lastMessage.type === 'received' || item.lastMessage.type === 'incoming',
  }));

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] bg-background overflow-hidden w-full">
      {/* Left Sidebar - Conversation List */}
      <div className={`${selectedLeadId ? 'hidden md:flex' : 'flex'} w-full md:w-96 border-r bg-card flex-col overflow-hidden flex-shrink-0`}>
        <div className="border-b px-4 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Messages</h1>
            {selectedLeadId && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => {
                  setSelectedLeadId(null);
                  setSelectedLeadName("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="divide-y">
              {inboxItemsWithNeedsReply.map((item) => {
                const isSelected = selectedLeadId === item.lead.id;
                const ChannelIcon = channelIcons[item.lastMessage.channel] || MessageSquare;
                
                // Use Facebook profile name if available, otherwise use lead name
                const displayName = item.lead.metadata?.facebookProfileName || item.lead.name;
                const isFacebookLead = item.lead.source === 'facebook' || item.lastMessage.channel === 'facebook';

                return (
                  <div
                    key={item.lead.id}
                    className={`flex items-center px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors group border-b w-full max-w-full ${
                      isSelected ? "bg-muted border-l-2 border-primary" : ""
                    } ${item.needsReply ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                    onClick={() => handleSelectLead(item.lead.id, displayName)}
                  >
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 flex-shrink-0 mr-3 relative">
                      <AvatarFallback>
                        {displayName
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                      {/* Needs Reply Indicator */}
                      {item.needsReply && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full border-2 border-background" />
                      )}
                    </Avatar>
                    
                    {/* Message Body - CRITICAL: flex-1 min-w-0 allows truncation */}
                    <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                      {/* Message Header: Name and Timestamp */}
                      <div className="flex items-baseline justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-semibold text-[15px] text-foreground truncate">
                            {displayName}
                          </span>
                          {item.needsReply && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-300">
                              Needs Reply
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {(() => {
                              try {
                                const dateStr = item.lastMessage.createdAt;
                                const date = parseISO(dateStr);
                                if (isNaN(date.getTime())) {
                                  const fallbackDate = new Date(dateStr);
                                  if (isNaN(fallbackDate.getTime())) {
                                    return dateStr;
                                  }
                                  return formatDistanceToNow(fallbackDate, { addSuffix: true });
                                }
                                return formatDistanceToNow(date, { addSuffix: true });
                              } catch (error) {
                                return item.lastMessage.createdAt;
                              }
                            })()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={(e) => handleDeleteInboxConversation(e, item.lead.id, item.lead.name)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Message Preview - TRUNCATION MAGIC */}
                      <div className="w-full max-w-full overflow-hidden">
                        <p 
                          className="text-sm text-muted-foreground m-0 whitespace-nowrap overflow-hidden text-ellipsis w-full"
                          title={stripHtmlAndDecode(item.lastMessage.message)}
                        >
                          {stripHtmlAndDecode(item.lastMessage.message)}
                        </p>
                      </div>
                      
                      {/* Unread Count Badge */}
                      {item.unreadCount > 0 && (
                        <div className="flex items-center justify-end mt-1">
                          <Badge
                            variant="destructive"
                            className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                          >
                            {item.unreadCount}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Right Side - Chat View - Separate container with proper boundaries */}
      <div className={`${selectedLeadId ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-card overflow-hidden min-w-0 relative`}>
        {selectedLeadId ? (
          <ChatView 
            leadId={selectedLeadId} 
            leadName={selectedLeadName}
            onBack={() => {
              setSelectedLeadId(null);
              setSelectedLeadName("");
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Inbox Conversation Dialog */}
      <AlertDialog open={deleteInboxDialogOpen} onOpenChange={setDeleteInboxDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entire conversation? This will permanently delete all messages with {leadToDelete?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeadToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leadToDelete) {
                  deleteInboxConversationMutation.mutate(leadToDelete.id);
                }
              }}
              disabled={deleteInboxConversationMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInboxConversationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AIMessages;
