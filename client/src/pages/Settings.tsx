import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
import { Brain, MessageSquare, Zap, Settings2, Save, Mail, CheckCircle, RefreshCw, AlertCircle, Info, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { useState, useEffect } from "react";

export default function Settings() {
  const { toast } = useToast();
  
  // Handle tab navigation from URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'ai-training';
  });
  
  const [greetingTemplate, setGreetingTemplate] = useState("");
  const [followupTemplate, setFollowupTemplate] = useState("");
  const [minIncome, setMinIncome] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [requireRefs, setRequireRefs] = useState(false);
  
  const [responseTone, setResponseTone] = useState("professional");
  const [responseSpeed, setResponseSpeed] = useState("immediate");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [suggestTours, setSuggestTours] = useState(true);
  
  const [autoRespond, setAutoRespond] = useState(true);
  const [followup24h, setFollowup24h] = useState(true);
  const [autoSendApp, setAutoSendApp] = useState(false);
  const [maxFollowups, setMaxFollowups] = useState("3");
  const [autoPilotMode, setAutoPilotMode] = useState(false);
  
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [pmsProvider, setPmsProvider] = useState("none");
  const [pmsApiKey, setPmsApiKey] = useState("");
  
  const [outlookEmail, setOutlookEmail] = useState("");
  const [outlookAppPassword, setOutlookAppPassword] = useState("");
  const [showSyncLogs, setShowSyncLogs] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showStopSyncDialog, setShowStopSyncDialog] = useState(false);
  const [userClosedLogs, setUserClosedLogs] = useState(false);
  
  const { progress, isPolling, startPolling, stopPolling, progressPercentage } = useSyncProgress();

  // Auto-enable polling and show logs if sync is already running (background sync support)
  // But only if user hasn't explicitly closed the logs
  useEffect(() => {
    if (progress?.isRunning && !isPolling && !userClosedLogs) {
      setShowSyncLogs(true);
      startPolling();
    }
  }, [progress?.isRunning, isPolling, startPolling, userClosedLogs]);

  const { data: responseSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/responses"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/responses");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setGreetingTemplate(settings.greeting_template || "");
        setFollowupTemplate(settings.followup_template || "");
      }
      return data;
    }
  });
  
  const { data: qualificationSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/qualification"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/qualification");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setMinIncome(settings.min_income || "");
        setCreditScore(settings.credit_score || "");
        setPetsAllowed(settings.pets_allowed === "true");
        setRequireRefs(settings.require_refs === "true");
      }
      return data;
    }
  });

  const { data: twilioConfig } = useQuery({ 
    queryKey: ["/api/integrations/twilio"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/twilio");
      if (!res.ok) return null;
      const data = await res.json();
      if (data) {
        setTwilioSid(data.config?.accountSid || "");
        setTwilioToken(data.config?.authToken || "");
        setTwilioPhone(data.config?.phoneNumber || "");
      }
      return data;
    }
  });

  const { data: gmailConfig, isLoading: gmailLoading } = useQuery({ 
    queryKey: ["/api/integrations/gmail"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/gmail");
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    }
  });

  // Derive connection status from query data
  const isGmailConnected = Boolean(
    gmailConfig && gmailConfig.config?.access_token && gmailConfig.isActive !== false
  );

  // Get Gmail new leads notifications
  interface Notification {
    id: string;
    type: string;
    read: boolean;
    metadata?: { newMessageCount?: number };
  }

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isGmailConnected,
  });

  const gmailNewLeadsNotifications = notifications.filter(
    (n) => n.type === "gmail_new_leads" && !n.read
  );
  
  const totalNewLeads = gmailNewLeadsNotifications.reduce(
    (sum, n) => sum + (n.metadata?.newMessageCount || 0),
    0
  );

  const { data: outlookConfig } = useQuery({ 
    queryKey: ["/api/integrations/outlook"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/outlook");
      if (!res.ok) return null;
      const data = await res.json();
      if (data) {
        setOutlookEmail(data.config?.email || "");
        setOutlookAppPassword(data.config?.appPassword || "");
      }
      return data;
    }
  });

  const saveSettingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ai-settings", data),
    onSuccess: (_, variables) => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/ai-settings/${variables.category}`] });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveIntegrationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/integrations", data),
    onSuccess: (_, variables) => {
      toast({ title: "Integration saved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/integrations/${variables.service}`] });
    },
    onError: () => {
      toast({ title: "Failed to save integration", variant: "destructive" });
    },
  });

  const saveTemplates = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "responses", key: "greeting_template", value: greetingTemplate });
      await saveSettingMutation.mutateAsync({ category: "responses", key: "followup_template", value: followupTemplate });
      toast({ title: "Templates saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save templates", variant: "destructive" });
    }
  };

  const saveCriteria = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "min_income", value: minIncome });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "credit_score", value: creditScore });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "pets_allowed", value: petsAllowed.toString() });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "require_refs", value: requireRefs.toString() });
      toast({ title: "Qualification criteria saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save criteria", variant: "destructive" });
    }
  };

  const saveBehavior = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_tone", value: responseTone });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_speed", value: responseSpeed });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "include_details", value: includeDetails.toString() });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "suggest_tours", value: suggestTours.toString() });
      toast({ title: "Response behavior saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save behavior", variant: "destructive" });
    }
  };

  const saveAutomation = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_respond", value: autoRespond.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "followup_24h", value: followup24h.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_send_app", value: autoSendApp.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "max_followups", value: maxFollowups });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_pilot_mode", value: autoPilotMode.toString() });
      toast({ title: "Automation rules saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save automation", variant: "destructive" });
    }
  };

  const saveTwilio = () => {
    saveIntegrationMutation.mutate({
      service: "twilio",
      config: {
        accountSid: twilioSid,
        authToken: twilioToken,
        phoneNumber: twilioPhone,
      },
      isActive: true,
    });
  };

  const savePMS = () => {
    if (pmsProvider !== "none") {
      saveIntegrationMutation.mutate({
        service: pmsProvider,
        config: { apiKey: pmsApiKey },
        isActive: true,
      });
    }
  };

  const connectGmail = async () => {
    try {
      console.log("[Gmail] Fetching auth URL...");
      const res = await fetch("/api/integrations/gmail/auth");
      console.log("[Gmail] Response status:", res.status);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("[Gmail] Response data:", data);
      
      if (data.url) {
        console.log("[Gmail] Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        throw new Error("No OAuth URL received from server");
      }
    } catch (error) {
      console.error("[Gmail] Connection error:", error);
      toast({ title: "Failed to initiate Gmail connection", variant: "destructive" });
    }
  };

  const deleteGmailLeadsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/leads/gmail-sourced", {}),
    onSuccess: () => {
      toast({ 
        title: "Gmail leads deleted", 
        description: "All leads from Gmail have been removed" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete leads", 
        variant: "destructive" 
      });
    },
  });

  const cancelSyncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/cancel-sync", {}),
  });

  const clearSyncProgressMutation = useMutation({
    mutationFn: () => {
      // Clear sync progress by removing historyId and pageToken from config
      // Use null instead of undefined for JSONB compatibility
      const clearedConfig = {
        ...gmailConfig?.config,
        lastHistoryId: null,
        pageToken: null,
      };
      return apiRequest("POST", "/api/integrations", {
        service: "gmail",
        config: clearedConfig,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail"] });
    },
  });

  const handleStopSync = (deleteLeads: boolean) => {
    // Cancel the backend sync process
    cancelSyncMutation.mutate();
    
    // Stop frontend polling
    if (isPolling) {
      stopPolling();
    }
    setShowSyncLogs(false);
    setUserClosedLogs(true); // Mark that user explicitly closed logs
    
    // Delete leads if requested
    if (deleteLeads) {
      deleteGmailLeadsMutation.mutate();
    }
    
    // Clear sync progress so it doesn't auto-resume
    clearSyncProgressMutation.mutate();
    
    setShowStopSyncDialog(false);
    toast({ 
      title: "Sync stopped", 
      description: deleteLeads 
        ? "Sync stopped and leads deleted" 
        : "Sync stopped, leads preserved" 
    });
  };

  const handleDisconnectGmail = (deleteLeads: boolean) => {
    // Cancel the backend sync process if running
    if (isPolling || progress?.isRunning) {
      cancelSyncMutation.mutate();
    }
    
    // Stop frontend polling
    if (isPolling) {
      stopPolling();
    }
    setShowSyncLogs(false);
    setUserClosedLogs(true); // Mark that user explicitly closed logs
    
    // Delete leads if requested
    if (deleteLeads) {
      deleteGmailLeadsMutation.mutate();
    }
    
    // Clear sync progress and disconnect Gmail integration
    // Use null instead of undefined for JSONB compatibility
    const clearedConfig = {
      ...gmailConfig?.config,
      lastHistoryId: null,
      pageToken: null,
    };
    
    saveIntegrationMutation.mutate(
      {
        service: "gmail",
        config: clearedConfig,
        isActive: false,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail"] });
          setShowDisconnectDialog(false);
          toast({ 
            title: "Gmail disconnected", 
            description: deleteLeads 
              ? "Gmail disconnected and all leads removed" 
              : "Gmail disconnected, leads preserved" 
          });
        }
      }
    );
  };

  const disconnectGmail = () => {
    // If sync is running, ask about leads
    if (isPolling || progress?.isRunning) {
      setShowDisconnectDialog(true);
    } else {
      // If sync is NOT running, just disconnect without asking about leads
      // Use null instead of undefined for JSONB compatibility
      const clearedConfig = {
        ...gmailConfig?.config,
        lastHistoryId: null,
        pageToken: null,
      };
      
      saveIntegrationMutation.mutate(
        {
          service: "gmail",
          config: clearedConfig,
          isActive: false,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail"] });
            toast({ 
              title: "Gmail disconnected successfully"
            });
          }
        }
      );
    }
  };

  const saveOutlook = () => {
    saveIntegrationMutation.mutate({
      service: "outlook",
      config: {
        email: outlookEmail,
        appPassword: outlookAppPassword,
      },
      isActive: true,
    });
  };

  const syncGmailMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/sync-from-gmail", {}),
    onSuccess: (data: any) => {
      const { summary = {}, total = 0 } = data;
      const created = summary.created || 0;
      
      toast({ 
        title: `✅ Sync Complete!`, 
        description: `Created ${created} new leads from ${total} emails`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      
      // Keep logs visible so user can review them
      // Polling will auto-stop after 2 seconds via useSyncProgress hook
    },
    onError: (error: any) => {
      toast({ title: "Failed to sync Gmail messages", variant: "destructive" });
      // Keep logs visible so user can see what went wrong
    },
  });

  const syncGmailLeads = () => {
    setShowSyncLogs(true);
    setUserClosedLogs(false); // Reset flag when starting new sync
    startPolling();
    syncGmailMutation.mutate();
  };

  // Handle OAuth redirect - refetch Gmail config when returning from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      queryClient.refetchQueries({ queryKey: ["/api/integrations/gmail"], type: 'active' });
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your AI assistant and system preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-training" data-testid="tab-ai-training">
            <Brain className="h-4 w-4 mr-2" />
            AI Training
          </TabsTrigger>
          <TabsTrigger value="responses" data-testid="tab-responses">
            <MessageSquare className="h-4 w-4 mr-2" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">
            <Zap className="h-4 w-4 mr-2" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Settings2 className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-training" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Templates</CardTitle>
              <CardDescription>Train your AI to respond in your voice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="greeting-template">Initial Greeting Template</Label>
                <Textarea
                  id="greeting-template"
                  placeholder="Hi {name}! Thanks for your interest in {property}..."
                  className="min-h-[100px]"
                  data-testid="textarea-greeting-template"
                  value={greetingTemplate}
                  onChange={(e) => setGreetingTemplate(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{property}"}, {"{units}"}, {"{rent}"}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="followup-template">Follow-up Template</Label>
                <Textarea
                  id="followup-template"
                  placeholder="Just checking in about your interest in {property}..."
                  className="min-h-[100px]"
                  data-testid="textarea-followup-template"
                  value={followupTemplate}
                  onChange={(e) => setFollowupTemplate(e.target.value)}
                />
              </div>

              <Button onClick={saveTemplates} disabled={saveSettingMutation.isPending} data-testid="button-save-templates">
                <Save className="h-4 w-4 mr-2" />
                Save Templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Qualification Criteria</CardTitle>
              <CardDescription>Set criteria for pre-qualifying leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min-income">Minimum Monthly Income</Label>
                <Input
                  id="min-income"
                  type="number"
                  placeholder="3000"
                  data-testid="input-min-income"
                  value={minIncome}
                  onChange={(e) => setMinIncome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credit-score">Minimum Credit Score</Label>
                <Input
                  id="credit-score"
                  type="number"
                  placeholder="650"
                  data-testid="input-credit-score"
                  value={creditScore}
                  onChange={(e) => setCreditScore(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pets Allowed</Label>
                  <p className="text-sm text-muted-foreground">Accept leads with pets</p>
                </div>
                <Switch checked={petsAllowed} onCheckedChange={setPetsAllowed} data-testid="switch-pets-allowed" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require References</Label>
                  <p className="text-sm text-muted-foreground">Request previous landlord references</p>
                </div>
                <Switch checked={requireRefs} onCheckedChange={setRequireRefs} data-testid="switch-require-references" />
              </div>

              <Button onClick={saveCriteria} disabled={saveSettingMutation.isPending} data-testid="button-save-criteria">
                <Save className="h-4 w-4 mr-2" />
                Save Criteria
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Behavior</CardTitle>
              <CardDescription>Configure how AI responds to inquiries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="response-tone">Response Tone</Label>
                <Select value={responseTone} onValueChange={setResponseTone}>
                  <SelectTrigger id="response-tone" data-testid="select-response-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="response-speed">Response Speed</Label>
                <Select value={responseSpeed} onValueChange={setResponseSpeed}>
                  <SelectTrigger id="response-speed" data-testid="select-response-speed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="1-min">1-2 minutes</SelectItem>
                    <SelectItem value="5-min">5 minutes</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Property Details</Label>
                  <p className="text-sm text-muted-foreground">Automatically share amenities and photos</p>
                </div>
                <Switch checked={includeDetails} onCheckedChange={setIncludeDetails} data-testid="switch-include-property-details" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Suggest Virtual Tours</Label>
                  <p className="text-sm text-muted-foreground">Offer virtual tour scheduling in responses</p>
                </div>
                <Switch checked={suggestTours} onCheckedChange={setSuggestTours} data-testid="switch-suggest-tours" />
              </div>

              <Button onClick={saveBehavior} disabled={saveSettingMutation.isPending} data-testid="button-save-behavior">
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Actions</CardTitle>
              <CardDescription>Configure automatic follow-ups and workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-respond to New Leads</Label>
                  <p className="text-sm text-muted-foreground">Send initial greeting automatically</p>
                </div>
                <Switch checked={autoRespond} onCheckedChange={setAutoRespond} data-testid="switch-auto-respond" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Follow-up After 24 Hours</Label>
                  <p className="text-sm text-muted-foreground">Send reminder if no response</p>
                </div>
                <Switch checked={followup24h} onCheckedChange={setFollowup24h} data-testid="switch-followup-24h" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-send Applications</Label>
                  <p className="text-sm text-muted-foreground">Send application to qualified leads</p>
                </div>
                <Switch checked={autoSendApp} onCheckedChange={setAutoSendApp} data-testid="switch-auto-send-applications" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Pilot Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve and send AI-generated replies (bypasses manual review)
                  </p>
                </div>
                <Switch 
                  checked={autoPilotMode} 
                  onCheckedChange={setAutoPilotMode} 
                  data-testid="switch-auto-pilot-mode" 
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="max-followups">Maximum Follow-ups</Label>
                <Input
                  id="max-followups"
                  type="number"
                  min="1"
                  max="10"
                  data-testid="input-max-followups"
                  value={maxFollowups}
                  onChange={(e) => setMaxFollowups(e.target.value)}
                />
              </div>

              <Button onClick={saveAutomation} disabled={saveSettingMutation.isPending} data-testid="button-save-automation">
                <Save className="h-4 w-4 mr-2" />
                Save Automation Rules
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Integrations</CardTitle>
              <CardDescription>Connect your email accounts to manage all communications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Gmail (OAuth)</h3>
                {gmailLoading ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading connection status...</span>
                  </div>
                ) : isGmailConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Gmail connected successfully</span>
                    </div>
                    
                    {/* New Leads Notification */}
                    {totalNewLeads > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20 dark:border-blue-400/30" data-testid="alert-new-leads">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <p className="font-medium">
                            {totalNewLeads} new lead{totalNewLeads > 1 ? 's' : ''} detected in Gmail
                          </p>
                          <p className="text-xs mt-1 opacity-90">
                            Click "Sync Gmail Leads" to import them into your CRM
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={syncGmailLeads} 
                        disabled={syncGmailMutation.isPending || isPolling}
                        data-testid="button-sync-gmail"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${(syncGmailMutation.isPending || isPolling) ? 'animate-spin' : ''}`} />
                        Sync Gmail Leads
                        {totalNewLeads > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-500 dark:bg-blue-400 text-white dark:text-blue-950 rounded-full text-xs font-medium">
                            {totalNewLeads}
                          </span>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={disconnectGmail} 
                        disabled={saveIntegrationMutation.isPending}
                        data-testid="button-disconnect-gmail"
                      >
                        Disconnect Gmail
                      </Button>
                    </div>

                    {/* Inline Progress and Logs */}
                    {showSyncLogs && progress && (
                      <div className="space-y-3 border rounded-md p-4 bg-muted/50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Sync Progress</h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              if (isPolling || progress?.isRunning) {
                                // If sync is running, show stop sync dialog (NOT disconnect)
                                setShowStopSyncDialog(true);
                              } else {
                                // If sync is complete, just close logs
                                setShowSyncLogs(false);
                                setUserClosedLogs(true); // Mark that user explicitly closed logs
                              }
                            }}
                            data-testid="button-close-sync-logs"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{progress.currentStep}</span>
                            <span className="font-medium">{progressPercentage}%</span>
                          </div>
                          <Progress value={progressPercentage} className="h-2" data-testid="sync-progress-bar" />
                          <div className="text-xs text-muted-foreground">
                            {progress.processedEmails} / {progress.totalEmails} emails processed
                          </div>
                        </div>

                        {/* Live Logs */}
                        {progress.logs.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-medium text-muted-foreground">
                              Sync Logs ({progress.logs.length} total)
                            </h5>
                            <div className="max-h-[300px] overflow-y-auto space-y-1 bg-background rounded-md p-2">
                              {progress.logs.slice().reverse().map((log, index) => (
                                <div
                                  key={index}
                                  className={`flex items-start gap-2 text-xs p-2 rounded ${
                                    log.type === 'success'
                                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                      : log.type === 'error'
                                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                      : log.type === 'warning'
                                      ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                      : 'bg-muted'
                                  }`}
                                  data-testid={`sync-log-${index}`}
                                >
                                  {log.type === 'success' && <CheckCircle className="h-3 w-3 shrink-0 mt-0.5" />}
                                  {log.type === 'error' && <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />}
                                  {log.type === 'warning' && <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />}
                                  {log.type === 'info' && <Info className="h-3 w-3 shrink-0 mt-0.5" />}
                                  <span className="flex-1">{log.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary (when complete) */}
                        {progress.summary && (
                          <div className="border-t pt-3 space-y-1">
                            <h5 className="text-xs font-medium">Summary</h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Created:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{progress.summary.created}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Duplicates:</span>
                                <span className="font-medium text-yellow-600 dark:text-yellow-400">{progress.summary.duplicates}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Skipped:</span>
                                <span className="font-medium">{progress.summary.skipped}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="font-medium text-red-600 dark:text-red-400">{progress.summary.errors}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Connect your Gmail account to read and respond to emails directly from LeadGenAI.
                      This uses secure OAuth authentication.
                    </p>
                    <Button onClick={connectGmail} data-testid="button-connect-gmail">
                      <Mail className="h-4 w-4 mr-2" />
                      Connect with Google
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Outlook / Office 365</h3>
                <div className="space-y-2">
                  <Label htmlFor="outlook-email">Outlook Email</Label>
                  <Input
                    id="outlook-email"
                    type="email"
                    placeholder="your-email@outlook.com"
                    data-testid="input-outlook-email"
                    value={outlookEmail}
                    onChange={(e) => setOutlookEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outlook-password">App Password</Label>
                  <Input
                    id="outlook-password"
                    type="password"
                    placeholder="••••••••••••••••"
                    data-testid="input-outlook-password"
                    value={outlookAppPassword}
                    onChange={(e) => setOutlookAppPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use app password from Microsoft account security settings
                  </p>
                </div>
                <Button onClick={saveOutlook} disabled={saveIntegrationMutation.isPending} data-testid="button-save-outlook">
                  <Save className="h-4 w-4 mr-2" />
                  Connect Outlook
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS & Calling (Twilio)</CardTitle>
              <CardDescription>Configure Twilio for SMS and voice calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                <Input
                  id="twilio-sid"
                  type="text"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  data-testid="input-twilio-sid"
                  value={twilioSid}
                  onChange={(e) => setTwilioSid(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilio-token">Twilio Auth Token</Label>
                <Input
                  id="twilio-token"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  data-testid="input-twilio-token"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                <Input
                  id="twilio-phone"
                  type="tel"
                  placeholder="+1234567890"
                  data-testid="input-twilio-phone"
                  value={twilioPhone}
                  onChange={(e) => setTwilioPhone(e.target.value)}
                />
              </div>

              <Button onClick={saveTwilio} disabled={saveIntegrationMutation.isPending} data-testid="button-save-twilio">
                <Save className="h-4 w-4 mr-2" />
                Save Twilio Config
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Property Management System</CardTitle>
              <CardDescription>Connect to your PMS for seamless data sync</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pms-provider">Provider</Label>
                <Select value={pmsProvider} onValueChange={setPmsProvider}>
                  <SelectTrigger id="pms-provider" data-testid="select-pms-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a provider</SelectItem>
                    <SelectItem value="buildium">Buildium</SelectItem>
                    <SelectItem value="appfolio">AppFolio</SelectItem>
                    <SelectItem value="yardi">Yardi</SelectItem>
                    <SelectItem value="rentmanager">Rent Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pms-api-key">API Key</Label>
                <Input
                  id="pms-api-key"
                  type="password"
                  placeholder="Enter your PMS API key"
                  data-testid="input-pms-api-key"
                  value={pmsApiKey}
                  onChange={(e) => setPmsApiKey(e.target.value)}
                />
              </div>

              <Button onClick={savePMS} disabled={saveIntegrationMutation.isPending} data-testid="button-save-pms">
                <Save className="h-4 w-4 mr-2" />
                Connect PMS
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stop Sync Confirmation Dialog */}
      <AlertDialog open={showStopSyncDialog} onOpenChange={setShowStopSyncDialog}>
        <AlertDialogContent data-testid="dialog-stop-sync">
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Gmail Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current sync process. 
              What would you like to do with the leads found so far?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap gap-2">
            <AlertDialogCancel data-testid="button-cancel-stop-sync">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleStopSync(false)}
              disabled={deleteGmailLeadsMutation.isPending || clearSyncProgressMutation.isPending}
              data-testid="button-keep-leads-stop-sync"
            >
              Keep Leads & Stop Sync
            </Button>
            <AlertDialogAction
              onClick={() => handleStopSync(true)}
              disabled={deleteGmailLeadsMutation.isPending || clearSyncProgressMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-leads-stop-sync"
            >
              Delete Leads & Stop Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Gmail Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent data-testid="dialog-disconnect-gmail">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Gmail Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop any running sync and disconnect your Gmail account. 
              What would you like to do with the leads found from Gmail?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap gap-2">
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleDisconnectGmail(false)}
              disabled={saveIntegrationMutation.isPending || deleteGmailLeadsMutation.isPending}
              data-testid="button-keep-leads-disconnect"
            >
              Keep Leads & Disconnect
            </Button>
            <AlertDialogAction
              onClick={() => handleDisconnectGmail(true)}
              disabled={saveIntegrationMutation.isPending || deleteGmailLeadsMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-leads-disconnect"
            >
              Delete Leads & Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
