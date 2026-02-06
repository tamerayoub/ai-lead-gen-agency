import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Mail, MessageSquare, Phone, Edit, Send, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
}

export function PendingRepliesQueue() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");

  const { data: pendingReplies = [] } = useQuery<PendingReply[]>({
    queryKey: ["/api/pending-replies"],
  });

  const approveMutation = useMutation({
    mutationFn: (replyId: string) => apiRequest("PATCH", `/api/pending-replies/${replyId}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Email sent successfully!", variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
    },
    onError: () => {
      toast({ title: "Failed to send email", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (replyId: string) => apiRequest("DELETE", `/api/pending-replies/${replyId}`, {}),
    onSuccess: () => {
      toast({ title: "Reply rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
    },
    onError: () => {
      toast({ title: "Failed to reject reply", variant: "destructive" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/scan-unanswered-leads", {}),
    onSuccess: (data: any) => {
      if (data.count > 0) {
        toast({ title: `Generated ${data.count} AI ${data.count === 1 ? 'reply' : 'replies'}!` });
      } else {
        toast({ title: "No unanswered leads found" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
    },
    onError: () => {
      toast({ title: "Failed to scan leads", variant: "destructive" });
    },
  });

  const handleEdit = (reply: PendingReply) => {
    setEditingId(reply.id);
    setEditedContent(reply.content);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ replyId, content }: { replyId: string; content: string }) => {
      return apiRequest("PATCH", `/api/pending-replies/${replyId}`, { content });
    },
    onSuccess: () => {
      toast({ title: "Reply updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
      setEditingId(null);
    },
    onError: () => {
      toast({ title: "Failed to update reply", variant: "destructive" });
    },
  });

  const handleSaveEdit = (reply: PendingReply) => {
    updateMutation.mutate({ replyId: reply.id, content: editedContent });
  };

  const regenerateMutation = useMutation({
    mutationFn: async ({ replyId, feedback }: { replyId: string; feedback: string }) => {
      const response = await apiRequest("POST", `/api/pending-replies/${replyId}/regenerate`, { feedback });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Reply regenerated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-replies"] });
      setRegenerateDialogOpen(false);
      setRegenerateFeedback("");
      setRegeneratingId(null);
    },
    onError: (error: any) => {
      console.error("Regenerate error:", error);
      toast({ 
        title: "Failed to regenerate reply",
        description: error?.message || "An error occurred while regenerating the reply",
        variant: "destructive" 
      });
      setRegenerateDialogOpen(false);
      setRegeneratingId(null);
    },
  });

  const handleRegenerate = (reply: PendingReply) => {
    setRegeneratingId(reply.id);
    setRegenerateDialogOpen(true);
  };

  const handleConfirmRegenerate = (reply: PendingReply) => {
    regenerateMutation.mutate({ replyId: reply.id, feedback: regenerateFeedback });
  };

  const pendingCount = pendingReplies.filter(r => r.status === 'pending').length;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Pending AI Replies
            </CardTitle>
            <CardDescription>Review and approve AI-generated responses</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              data-testid="button-scan-unanswered"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              Scan for Unanswered
            </Button>
            {pendingCount > 0 && (
              <Badge variant="secondary" data-testid="pending-count">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pendingReplies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending replies at the moment
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {pendingReplies.map((reply) => (
                <Card key={reply.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(reply.channel)}
                          <span className="font-semibold">{reply.leadName}</span>
                          <Badge variant="outline" className="text-xs">
                            {reply.leadEmail}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{reply.subject}</p>
                      </div>
                      <Badge variant={reply.status === 'pending' ? 'default' : 'secondary'}>
                        {reply.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {reply.originalMessage && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Lead's Inquiry</Badge>
                        </div>
                        <div className="rounded-md bg-muted/50 border p-4 text-sm whitespace-pre-wrap" data-testid={`original-message-${reply.id}`}>
                          {reply.originalMessage}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs bg-primary/80">AI Response</Badge>
                      </div>
                      {editingId === reply.id ? (
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="min-h-[150px]"
                          data-testid={`textarea-edit-reply-${reply.id}`}
                        />
                      ) : (
                        <div className="rounded-md bg-primary/5 border border-primary/20 p-4 text-sm whitespace-pre-wrap" data-testid={`ai-response-${reply.id}`}>
                          {reply.content}
                        </div>
                      )}
                    </div>

                    {reply.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        {editingId === reply.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(reply)}
                              data-testid={`button-save-edit-${reply.id}`}
                            >
                              Save Changes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              data-testid={`button-cancel-edit-${reply.id}`}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(reply.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${reply.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve & Send
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(reply)}
                              data-testid={`button-edit-${reply.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRegenerate(reply)}
                              disabled={regenerateMutation.isPending}
                              data-testid={`button-regenerate-${reply.id}`}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Regenerate
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(reply.id)}
                              disabled={rejectMutation.isPending}
                              data-testid={`button-reject-${reply.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={(open) => {
        setRegenerateDialogOpen(open);
        if (!open) {
          setRegeneratingId(null);
          setRegenerateFeedback("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate AI Reply</DialogTitle>
            <DialogDescription>
              Provide feedback to improve the AI response. Examples: "shorter", "more friendly", "add pricing details", "more professional"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    const reply = pendingReplies.find(r => r.id === regeneratingId);
                    if (reply) handleConfirmRegenerate(reply);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to regenerate with the same information but improved wording
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegenerateDialogOpen(false);
                setRegeneratingId(null);
                setRegenerateFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const reply = pendingReplies.find(r => r.id === regeneratingId);
                if (reply) handleConfirmRegenerate(reply);
              }}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
