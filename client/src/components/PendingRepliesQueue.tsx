import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Mail, MessageSquare, Phone, Edit, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PendingReply {
  id: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  subject: string;
  content: string;
  channel: string;
  status: string;
  createdAt: string;
}

export function PendingRepliesQueue() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");

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

  const handleEdit = (reply: PendingReply) => {
    setEditingId(reply.id);
    setEditedContent(reply.content);
  };

  const handleSaveEdit = (reply: PendingReply) => {
    // TODO: Implement update endpoint
    setEditingId(null);
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
          {pendingCount > 0 && (
            <Badge variant="secondary" data-testid="pending-count">
              {pendingCount} pending
            </Badge>
          )}
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
                  <CardContent className="space-y-3">
                    {editingId === reply.id ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="min-h-[150px]"
                        data-testid={`textarea-edit-reply-${reply.id}`}
                      />
                    ) : (
                      <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                        {reply.content}
                      </div>
                    )}

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
    </Card>
  );
}
