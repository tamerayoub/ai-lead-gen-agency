import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Bot, Loader2, MessageSquare, User, Send, Check, X, Edit2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { linkifyText } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AITraining() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Personality settings state
  const [friendliness, setFriendliness] = useState<string>("professional");
  const [formality, setFormality] = useState<string>("professional");
  const [responseLength, setResponseLength] = useState<string>("detailed");
  const [urgency, setUrgency] = useState<string>("moderate");
  const [warmth, setWarmth] = useState<string>("moderate");
  const [communicationStyle, setCommunicationStyle] = useState<string>("informational");
  const [isSavingPersonality, setIsSavingPersonality] = useState(false);

  // Fetch personality settings
  const { data: personalitySettings, isLoading: isLoadingPersonality } = useQuery({
    queryKey: ["/api/ai-settings/personality"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-settings/personality");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Load personality settings into state
  useEffect(() => {
    if (personalitySettings && personalitySettings.length > 0) {
      const settingsMap = personalitySettings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
      setFriendliness(settingsMap.friendliness || "professional");
      setFormality(settingsMap.formality || "professional");
      setResponseLength(settingsMap.response_length || "detailed");
      setUrgency(settingsMap.urgency || "moderate");
      setWarmth(settingsMap.warmth || "moderate");
      setCommunicationStyle(settingsMap.communication_style || "informational");
    }
  }, [personalitySettings]);

  // Save personality settings mutation
  const savePersonalityMutation = useMutation({
    mutationFn: async (settings: Array<{ category: string; key: string; value: string }>) => {
      await Promise.all(
        settings.map((setting) =>
          apiRequest("POST", "/api/ai-settings", setting)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings/personality"] });
      toast({
        title: "Settings saved",
        description: "AI personality settings have been updated successfully.",
      });
      setIsSavingPersonality(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save personality settings",
        variant: "destructive",
      });
      setIsSavingPersonality(false);
    },
  });

  const handleSavePersonality = async () => {
    setIsSavingPersonality(true);
    const settings = [
      { category: "personality", key: "friendliness", value: friendliness },
      { category: "personality", key: "formality", value: formality },
      { category: "personality", key: "response_length", value: responseLength },
      { category: "personality", key: "urgency", value: urgency },
      { category: "personality", key: "warmth", value: warmth },
      { category: "personality", key: "communication_style", value: communicationStyle },
    ];
    savePersonalityMutation.mutate(settings);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Training</h1>
        <p className="text-muted-foreground mt-1">Customize AI responses and behavior</p>
      </div>

      <Tabs defaultValue="interactive" className="w-full">
        <TabsList>
          <TabsTrigger value="interactive" data-testid="tab-interactive">Interactive Training</TabsTrigger>
          <TabsTrigger value="personality" data-testid="tab-personality">AI Personality & Tone Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="interactive" className="mt-6">
          <InteractiveTraining />
        </TabsContent>

        <TabsContent value="personality" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Personality & Tone Configuration</CardTitle>
              <CardDescription>
                Customize the AI's communication style. These settings apply consistently across all channels (Email, SMS, Facebook Messenger, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Friendliness */}
                <div className="space-y-2">
                <Label htmlFor="friendliness">Friendliness Level</Label>
                <Select value={friendliness} onValueChange={setFriendliness}>
                  <SelectTrigger id="friendliness">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly - Warm, approachable, enthusiastic</SelectItem>
                    <SelectItem value="professional">Professional - Businesslike, respectful, courteous</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how friendly and approachable the AI should be
                </p>
              </div>

              {/* Formality */}
                <div className="space-y-2">
                <Label htmlFor="formality">Formality Level</Label>
                <Select value={formality} onValueChange={setFormality}>
                  <SelectTrigger id="formality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conversational">Conversational - Relaxed, uses contractions, casual style</SelectItem>
                    <SelectItem value="formal">Formal - Proper grammar, structured, no contractions</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the level of formality in language and structure
                </p>
              </div>

              {/* Response Length */}
              <div className="space-y-2">
                <Label htmlFor="responseLength">Response Length</Label>
                <Select value={responseLength} onValueChange={setResponseLength}>
                  <SelectTrigger id="responseLength">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-paragraph">1 Paragraph - Very concise, single paragraph response</SelectItem>
                    <SelectItem value="short">Short - Concise (2-3 paragraphs), get to the point quickly</SelectItem>
                    <SelectItem value="detailed">Detailed - Thorough (3-4 paragraphs), comprehensive information</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how detailed and comprehensive responses should be
                </p>
                </div>

              <Separator />

                  <div>
                <h3 className="text-sm font-semibold mb-4">Leasing-Specific Tone Controls</h3>
                <div className="space-y-4">
                  {/* Urgency */}
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency Level</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger id="urgency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Relaxed, no-pressure approach</SelectItem>
                        <SelectItem value="moderate">Moderate - Balanced, mention availability naturally</SelectItem>
                        <SelectItem value="high">High - Create urgency, encourage quick action</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Control how much urgency the AI creates in responses
                    </p>
                </div>

                  {/* Warmth */}
                  <div className="space-y-2">
                    <Label htmlFor="warmth">Warmth Level</Label>
                    <Select value={warmth} onValueChange={setWarmth}>
                      <SelectTrigger id="warmth">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Factual, straightforward, professional distance</SelectItem>
                        <SelectItem value="moderate">Moderate - Personable, professional warmth</SelectItem>
                        <SelectItem value="high">High - Genuine warmth, empathetic, personal interest</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Control how warm and personal the AI's responses are
                    </p>
                </div>

                  {/* Communication Style */}
                  <div className="space-y-2">
                    <Label htmlFor="communicationStyle">Communication Style</Label>
                    <Select value={communicationStyle} onValueChange={setCommunicationStyle}>
                      <SelectTrigger id="communicationStyle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informational">Informational - Provide clear info, answer questions, no pressure</SelectItem>
                        <SelectItem value="sales-assist">Sales-Assist - Highlight benefits, create excitement, guide toward action</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose whether the AI should be informative or sales-oriented
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <Button onClick={handleSavePersonality} disabled={isSavingPersonality} className="w-full sm:w-auto">
                {isSavingPersonality ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                <Save className="h-4 w-4 mr-2" />
                    Save Personality Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Interactive Training Component
function InteractiveTraining() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [leadMessage, setLeadMessage] = useState("");
  
  // Get current organization to scope conversation history
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
  });
  
  // CRITICAL: Scope conversation history to organization
  // Each organization should have its own conversation history
  const getStorageKey = (orgId: string | undefined): string => {
    if (!orgId) return 'ai-training-conversation-history-default';
    return `ai-training-conversation-history-${orgId}`;
  };
  
  // Load conversation history from localStorage on mount - scoped to current org
  const loadConversationHistory = (orgId: string | undefined): Array<{
    id: string;
    role: 'lead' | 'ai' | 'corrected';
    message: string;
    timestamp: Date;
    correctionId?: string;
  }> => {
    try {
      const storageKey = getStorageKey(orgId);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch (error) {
      console.error('Error loading conversation history from localStorage:', error);
    }
    return [];
  };

  const [conversationHistory, setConversationHistory] = useState<Array<{
    id: string;
    role: 'lead' | 'ai' | 'corrected';
    message: string;
    timestamp: Date;
    correctionId?: string;
  }>>([]);

  // Load conversation history when org is available
  useEffect(() => {
    if (currentOrg?.orgId) {
      const history = loadConversationHistory(currentOrg.orgId);
      setConversationHistory(history);
      console.log(`[AI Training] Loaded ${history.length} messages for orgId: ${currentOrg.orgId}`);
    }
  }, [currentOrg?.orgId]);
  
  // CRITICAL: Clear and reload conversation history when organization changes
  const prevOrgIdRef = useRef<string | undefined>(currentOrg?.orgId);
  useEffect(() => {
    if (currentOrg?.orgId && prevOrgIdRef.current !== currentOrg.orgId) {
      console.log(`[AI Training] Organization changed from ${prevOrgIdRef.current} to ${currentOrg.orgId} - clearing conversation history`);
      // Clear conversation history when switching organizations
      setConversationHistory([]);
      // Load conversation history for the new organization
      const newHistory = loadConversationHistory(currentOrg.orgId);
      setConversationHistory(newHistory);
    }
    prevOrgIdRef.current = currentOrg?.orgId;
  }, [currentOrg?.orgId]);
  
  const [editingCorrection, setEditingCorrection] = useState<string | null>(null);
  const [correctedText, setCorrectedText] = useState("");

  // Save conversation history to localStorage whenever it changes - scoped to current org
  useEffect(() => {
    if (!currentOrg?.orgId) return; // Don't save if no org context
    
    try {
      const storageKey = getStorageKey(currentOrg.orgId);
      const serialized = conversationHistory.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(), // Convert Date to string for JSON
      }));
      localStorage.setItem(storageKey, JSON.stringify(serialized));
      console.log(`[AI Training] Saved conversation history for orgId: ${currentOrg.orgId}`);
    } catch (error) {
      console.error('Error saving conversation history to localStorage:', error);
    }
  }, [conversationHistory, currentOrg?.orgId]);

  // Scroll to bottom when conversation history loads or updates
  useEffect(() => {
    if (conversationHistory.length > 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const container = scrollRef.current?.closest('.overflow-y-auto') as HTMLElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        } else if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    }
  }, [conversationHistory.length, conversationHistory]);

  const handleClearConversation = () => {
    if (confirm('Are you sure you want to clear the conversation history? This cannot be undone.')) {
      setConversationHistory([]);
      // Remove conversation history for current org only
      if (currentOrg?.orgId) {
        const storageKey = getStorageKey(currentOrg.orgId);
        localStorage.removeItem(storageKey);
        console.log(`[AI Training] Cleared conversation history for orgId: ${currentOrg.orgId}`);
      }
      toast({
        title: "Conversation cleared",
        description: "The conversation history has been cleared",
      });
    }
  };

  // Fetch existing corrections - CRITICAL: Include orgId in query key to refetch when org changes
  const { data: corrections = [] } = useQuery({
    queryKey: ["/api/ai-training/corrections", currentOrg?.orgId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-training/corrections");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentOrg?.orgId, // Only fetch when we have an org context
  });

  // Generate AI response for practice
  const practiceMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai-training/practice", {
        leadMessage: message,
        conversationHistory: conversationHistory.filter(m => m.role !== 'corrected').map(m => ({
          role: m.role === 'lead' ? 'lead' : 'assistant',
          message: m.message,
        })),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate AI response");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const newMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai' as const,
        message: data.response,
        timestamp: new Date(),
      };
      setConversationHistory(prev => [...prev, newMessage]);
      setLeadMessage("");
      // Scroll to bottom after new message is added
      setTimeout(() => {
        const container = scrollRef.current?.closest('.overflow-y-auto') as HTMLElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        } else if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 150);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate AI response",
        variant: "destructive",
      });
    },
  });

  // Save correction
  const saveCorrectionMutation = useMutation({
    mutationFn: async ({ aiMessageId, correctedMessage, originalMessage }: {
      aiMessageId: string;
      correctedMessage: string;
      originalMessage: string;
    }) => {
      // Find the lead message that came before this AI message
      const aiMessageIndex = conversationHistory.findIndex(m => m.id === aiMessageId);
      let leadMessage = '';
      if (aiMessageIndex > 0) {
        // Look backwards to find the most recent lead message
        for (let i = aiMessageIndex - 1; i >= 0; i--) {
          if (conversationHistory[i].role === 'lead') {
            leadMessage = conversationHistory[i].message;
            break;
          }
        }
      }
      
      console.log('[Frontend] Saving correction:', { aiMessageId, leadMessage, originalMessage: originalMessage.substring(0, 50) });
      
      const res = await apiRequest("POST", "/api/ai-training/correction", {
        aiMessageId,
        originalMessage,
        correctedMessage,
        leadMessage: leadMessage || 'Practice message',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save correction");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Update conversation history with corrected message
      setConversationHistory(prev => prev.map(msg => 
        msg.id === variables.aiMessageId 
          ? { ...msg, role: 'corrected' as const, message: variables.correctedMessage, correctionId: data.correction.id }
          : msg
      ));
      setEditingCorrection(null);
      setCorrectedText("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai-training/corrections"] });
      toast({
        title: "Correction saved",
        description: "This correction will help improve future AI responses",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save correction",
        variant: "destructive",
      });
    },
  });

  const handleSendLeadMessage = () => {
    if (!leadMessage.trim()) return;
    
    const newMessage = {
      id: `lead-${Date.now()}`,
      role: 'lead' as const,
      message: leadMessage.trim(),
      timestamp: new Date(),
    };
    setConversationHistory(prev => [...prev, newMessage]);
    practiceMutation.mutate(leadMessage.trim());
    // Scroll to bottom after sending message
    setTimeout(() => {
      const container = scrollRef.current?.closest('.overflow-y-auto') as HTMLElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  };

  const handleStartCorrection = (messageId: string, currentMessage: string) => {
    setEditingCorrection(messageId);
    setCorrectedText(currentMessage);
  };

  const handleSaveCorrection = (messageId: string, originalMessage: string) => {
    if (!correctedText.trim()) {
      toast({
        title: "Error",
        description: "Corrected message cannot be empty",
        variant: "destructive",
      });
      return;
    }
    saveCorrectionMutation.mutate({
      aiMessageId: messageId,
      originalMessage,
      correctedMessage: correctedText.trim(),
    });
  };

  const handleCancelCorrection = () => {
    setEditingCorrection(null);
    setCorrectedText("");
  };

  // Scroll to bottom when conversation history loads or updates (removed duplicate)
  // This effect is handled above

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Interactive Training</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Act as a lead and send messages. Review AI responses and correct them to train the AI on the right way to communicate.
            </p>
          </div>
          {conversationHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearConversation}
              className="ml-4"
            >
              <X className="h-4 w-4 mr-1" />
              Clear History
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {/* Conversation History - Fixed height container with scrollable content and fixed input */}
        <div className="border rounded-lg flex flex-col" style={{ height: 'calc(100vh - 350px)', minHeight: '500px', maxHeight: '800px' }}>
          {/* Scrollable Messages Area */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4" ref={scrollRef}>
              {conversationHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Start a conversation by sending a message as a lead</p>
                  </div>
                </div>
              ) : (
                conversationHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'lead' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'lead' ? (
                      <div className="flex gap-2 max-w-[80%]">
                        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3 w-3" />
                            <span className="text-xs font-medium">You (as Lead)</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {linkifyText(msg.message).map((part) =>
                              part.type === 'url' ? (
                                <a key={part.key} href={part.content} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : part.type === 'email' ? (
                                <a key={part.key} href={`mailto:${part.content}`} className="underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : part.type === 'phone' ? (
                                <a key={part.key} href={`tel:${part.content.replace(/\s/g, '')}`} className="underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : (
                                <span key={part.key}>{part.content}</span>
                              )
                            )}
                          </p>
                        </div>
                      </div>
                    ) : editingCorrection === msg.id ? (
                      <div className="flex gap-2 max-w-[80%]">
                        <div className="bg-muted rounded-lg px-4 py-2 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-3 w-3 text-primary" />
                            <span className="text-xs font-medium">AI Response (Editing)</span>
                          </div>
                          <Textarea
                            value={correctedText}
                            onChange={(e) => setCorrectedText(e.target.value)}
                            className="min-h-[100px] mb-2"
                            placeholder="Edit the AI response..."
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveCorrection(msg.id, msg.message)}
                              disabled={saveCorrectionMutation.isPending}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Save Correction
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelCorrection}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 max-w-[80%]">
                        <div className={`rounded-lg px-4 py-2 ${
                          msg.role === 'corrected' 
                            ? 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800' 
                            : 'bg-muted'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-3 w-3 text-primary" />
                            <span className="text-xs font-medium">
                              {msg.role === 'corrected' ? 'AI Response (Corrected)' : 'AI Response'}
                            </span>
                            {msg.role === 'corrected' && (
                              <Badge variant="outline" className="text-xs">Corrected</Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {linkifyText(msg.message).map((part) =>
                              part.type === 'url' ? (
                                <a key={part.key} href={part.content} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : part.type === 'email' ? (
                                <a key={part.key} href={`mailto:${part.content}`} className="text-primary underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : part.type === 'phone' ? (
                                <a key={part.key} href={`tel:${part.content.replace(/\s/g, '')}`} className="text-primary underline hover:no-underline break-all">
                                  {part.content}
                                </a>
                              ) : (
                                <span key={part.key}>{part.content}</span>
                              )
                            )}
                          </p>
                          {msg.role !== 'corrected' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 h-7 text-xs"
                              onClick={() => handleStartCorrection(msg.id, msg.message)}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Correct This
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t p-4 bg-background flex-shrink-0 sticky bottom-0">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type a message as if you were a lead inquiring about a property..."
                value={leadMessage}
                onChange={(e) => setLeadMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendLeadMessage();
                  }
                }}
                className="min-h-[80px]"
                disabled={practiceMutation.isPending}
                autoComplete="off"
                inputMode="text"
              />
              <Button
                onClick={handleSendLeadMessage}
                disabled={practiceMutation.isPending || !leadMessage.trim()}
                className="self-end"
              >
                {practiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Corrections Summary */}
        {corrections.length > 0 && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Training Progress</h4>
              <Badge>{corrections.length} corrections saved</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI is learning from your corrections. Each correction improves future responses.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

