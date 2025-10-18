import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bot, User, Phone, Mail, MessageSquare, Send, Sparkles, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { format, isToday, isYesterday, differenceInDays, parseISO } from "date-fns";

interface ConversationMessage {
  id: string;
  type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
  channel: "email" | "sms" | "phone" | "system";
  message: string;
  timestamp: string;
  aiGenerated?: boolean;
  emailSubject?: string;
  sourceIntegration?: string;
  deliveryStatus?: "sent" | "failed" | "pending" | null;
  deliveryError?: string | null;
}

interface ConversationTimelineProps {
  messages: ConversationMessage[];
  leadName: string;
  onSendMessage?: (message: string, integration: string, emailSubject: string) => void;
  onAIReply?: () => void;
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  availableIntegrations?: Array<{ id: string; name: string }>;
  integrationsLoading?: boolean;
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  system: Bot,
};

const integrationLabels = {
  gmail: "Gmail",
  outlook: "Outlook",
};

export function ConversationTimeline({ messages, leadName, onSendMessage, onAIReply, onRetryMessage, onDeleteMessage, availableIntegrations = [], integrationsLoading = false }: ConversationTimelineProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [threadOption, setThreadOption] = useState<string>("");
  const [newSubject, setNewSubject] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState({
    integration: false,
    thread: false,
    subject: false,
    message: false,
  });

  // Extract unique email subjects from messages, filtered by selected integration
  const existingSubjects = useMemo(() => {
    if (!selectedIntegration) return [];
    
    const subjects = messages
      .filter(msg => 
        msg.channel === 'email' && 
        msg.emailSubject && 
        msg.sourceIntegration === selectedIntegration
      )
      .map(msg => msg.emailSubject!)
      .filter((subject, index, self) => self.indexOf(subject) === index);
    return subjects;
  }, [messages, selectedIntegration]);

  // Reset thread/subject options and validation errors when integration changes
  useEffect(() => {
    if (selectedIntegration) {
      // Reset thread option and subject when switching integrations
      setThreadOption("");
      setSelectedExistingSubject("");
      setNewSubject("");
      // Clear validation errors for thread/subject/message when integration changes
      setValidationErrors(prev => ({
        ...prev,
        thread: false,
        subject: false,
        message: false,
      }));
    }
  }, [selectedIntegration]);

  // Set default thread option when integration is selected
  useEffect(() => {
    if (selectedIntegration && !threadOption) {
      setThreadOption(existingSubjects.length > 0 ? "existing" : "new");
    }
  }, [selectedIntegration, threadOption, existingSubjects]);

  // Set default existing subject when available
  useEffect(() => {
    if (existingSubjects.length > 0 && !selectedExistingSubject && threadOption === "existing") {
      setSelectedExistingSubject(existingSubjects[0]);
    }
  }, [existingSubjects, selectedExistingSubject, threadOption]);

  // Determine if message is from lead (received/incoming/user) or from us (outgoing/sent/ai)
  const isFromLead = (type: string) => type === "received" || type === "incoming" || type === "user";
  const isFromUs = (type: string) => type === "outgoing" || type === "sent" || type === "ai";

  const handleSend = async () => {
    if (!onSendMessage) return;

    // Validate required fields
    const errors = {
      integration: !selectedIntegration,
      thread: !threadOption,
      subject: threadOption === "new" && !newSubject.trim(),
      message: !newMessage.trim(),
    };

    setValidationErrors(errors);

    // If there are validation errors, don't proceed
    if (errors.integration || errors.thread || errors.subject || errors.message) {
      return;
    }
    
    // Determine the email subject to use
    let emailSubject = "";
    if (threadOption === "new") {
      emailSubject = newSubject;
    } else {
      emailSubject = selectedExistingSubject || existingSubjects[0] || "Re: Property Inquiry";
    }
    
    setIsSending(true);
    try {
      await onSendMessage(newMessage, selectedIntegration, emailSubject);
      setNewMessage("");
      // Reset validation errors on successful send
      setValidationErrors({ integration: false, thread: false, subject: false, message: false });
      // Reset new subject if it was used
      if (threadOption === "new") {
        setNewSubject("");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getLeadInitials = () => {
    return leadName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      const now = new Date();
      const daysDiff = differenceInDays(now, date);

      if (isToday(date)) {
        // Less than 24 hours: show time only
        return format(date, "h:mm a");
      } else if (daysDiff <= 7) {
        // Within 7 days: show day of week and time
        return format(date, "EEEE h:mm a");
      } else {
        // More than 7 days: show full date and time
        return format(date, "MMM d, h:mm a");
      }
    } catch (error) {
      // If parsing fails, return original timestamp
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No conversation yet
          </div>
        ) : (
          messages.map((msg) => {
            const ChannelIcon = channelIcons[msg.channel];
            const fromLead = isFromLead(msg.type);
            const fromUs = isFromUs(msg.type);

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 items-start",
                  fromUs && "flex-row-reverse"
                )}
                data-testid={`message-${msg.id}`}
              >
                {/* Avatar - only show for lead messages */}
                {fromLead && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {getLeadInitials()}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* Message Content */}
                <div className={cn(
                  "flex-1 space-y-1",
                  fromLead && "max-w-[70%]",
                  fromUs && "flex flex-col items-end max-w-[70%]"
                )}>
                  {/* Sender Name */}
                  <div className={cn(
                    "flex items-center gap-2 text-xs",
                    fromUs && "flex-row-reverse"
                  )}>
                    <span className="font-medium">
                      {fromLead ? leadName : "You"}
                    </span>
                    <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                    {msg.aiGenerated && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Bot className="h-3 w-3" />
                        AI
                      </Badge>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <Card className={cn(
                    "p-3",
                    fromLead && "bg-accent/50 border-accent",
                    fromUs && "bg-primary text-primary-foreground border-primary"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </Card>

                  {/* Email Metadata */}
                  {msg.channel === 'email' && (msg.emailSubject || msg.sourceIntegration) && (
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs text-muted-foreground mt-1",
                      fromUs && "justify-end"
                    )}>
                      <Mail className="h-3 w-3" />
                      {msg.sourceIntegration && (
                        <span className="font-medium" data-testid={`text-${msg.sourceIntegration}`}>
                          {integrationLabels[msg.sourceIntegration as keyof typeof integrationLabels]}
                        </span>
                      )}
                      {msg.emailSubject && (
                        <>
                          {msg.sourceIntegration && <span>•</span>}
                          <span className="truncate" data-testid="text-email-subject">
                            {msg.emailSubject}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Timestamp - shown below email metadata */}
                  <div className={cn(
                    "text-xs text-muted-foreground",
                    fromUs && "text-right"
                  )}>
                    {formatTimestamp(msg.timestamp)}
                  </div>

                  {/* Delivery Error */}
                  {fromUs && msg.deliveryStatus === 'failed' && msg.deliveryError && (
                    <div className={cn(
                      "rounded-md border border-destructive bg-destructive/10 p-2 space-y-2",
                      fromUs && "w-full"
                    )}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-destructive">Email failed to send</p>
                          <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-delivery-error">
                            {msg.deliveryError}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {onRetryMessage && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs flex-1"
                            onClick={() => onRetryMessage(msg.id)}
                            data-testid="button-retry-email"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Retry Sending
                          </Button>
                        )}
                        {onDeleteMessage && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs flex-1"
                            onClick={() => onDeleteMessage(msg.id)}
                            data-testid="button-delete-message"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t pt-4 space-y-3">
        {/* Loading State */}
        {integrationsLoading && (
          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="text-muted-foreground">Loading integrations...</p>
          </div>
        )}

        {/* No Integrations Message */}
        {!integrationsLoading && availableIntegrations.length === 0 && (
          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="font-medium mb-1">No integrations set up</p>
            <p className="text-muted-foreground">
              Please set up an integration (Gmail or Outlook) in the Integrations page to send messages.
            </p>
          </div>
        )}

        {/* Step 1: Integration Selector */}
        {!integrationsLoading && availableIntegrations.length > 0 && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Step 1: Select Integration <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedIntegration}
                onValueChange={(value) => {
                  setSelectedIntegration(value);
                  // Clear validation error when user selects
                  setValidationErrors(prev => ({ ...prev, integration: false }));
                }}
                disabled={isSending}
              >
                <SelectTrigger 
                  data-testid="select-integration"
                  className={cn(validationErrors.integration && "border-destructive focus:ring-destructive")}
                >
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
              {validationErrors.integration && (
                <p className="text-xs text-destructive">Please select an integration</p>
              )}
            </div>

            {/* Step 2: Thread/Subject Options (only show if integration is selected) */}
            {selectedIntegration && (
              <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Step 2: Email Thread <span className="text-destructive">*</span>
              </Label>
              <Select
                value={threadOption}
                onValueChange={(value) => {
                  setThreadOption(value);
                  setValidationErrors(prev => ({ ...prev, thread: false }));
                  if (value === "new") {
                    setNewSubject("");
                  }
                }}
                disabled={isSending}
              >
                <SelectTrigger 
                  data-testid="select-thread-option"
                  className={cn(validationErrors.thread && "border-destructive focus:ring-destructive")}
                >
                  <SelectValue placeholder="Choose thread option..." />
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
              {validationErrors.thread && (
                <p className="text-xs text-destructive">Please select a thread option</p>
              )}
            </div>

            {/* Existing Subject Selector (when threadOption is "existing" and subjects exist) */}
            {threadOption === "existing" && existingSubjects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Select existing subject</Label>
                <Select
                  value={selectedExistingSubject}
                  onValueChange={setSelectedExistingSubject}
                  disabled={isSending}
                >
                  <SelectTrigger data-testid="select-existing-subject">
                    <SelectValue placeholder="Choose a subject" />
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

            {/* New Subject Input (when threadOption is "new") */}
            {threadOption === "new" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Email Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter email subject..."
                  value={newSubject}
                  onChange={(e) => {
                    setNewSubject(e.target.value);
                    setValidationErrors(prev => ({ ...prev, subject: false }));
                  }}
                  disabled={isSending}
                  data-testid="input-new-subject"
                  className={cn(validationErrors.subject && "border-destructive focus:ring-destructive")}
                />
                {validationErrors.subject && (
                  <p className="text-xs text-destructive">Please enter a subject</p>
                )}
              </div>
            )}
              </>
            )}

            {/* Step 3: Message Input (only show if integration is selected) */}
            {selectedIntegration && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Step 3: Your Message <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        setValidationErrors(prev => ({ ...prev, message: false }));
                      }}
                      onKeyPress={handleKeyPress}
                      disabled={isSending}
                      data-testid="input-reply-message"
                      className={cn(validationErrors.message && "border-destructive focus:ring-destructive")}
                    />
                    {validationErrors.message && (
                      <p className="text-xs text-destructive">Please enter a message</p>
                    )}
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={isSending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        
        {onAIReply && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onAIReply}
            data-testid="button-ai-reply"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Reply
          </Button>
        )}
      </div>
    </div>
  );
}
