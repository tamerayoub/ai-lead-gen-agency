import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { SiGoogle, SiZillow, SiMeta, SiFacebook } from "react-icons/si";
import { Mail, Building2, CheckCircle2, Settings as SettingsIcon, RefreshCw, XCircle, AlertCircle, Info, Phone, MessageSquare, FileSpreadsheet, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { useState, useEffect } from "react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "configured" | "available" | "coming-soon";
  category: string;
  provider?: string;
}

export default function Integrations() {
  const { toast } = useToast();
  const [showSyncLogs, setShowSyncLogs] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showStopSyncDialog, setShowStopSyncDialog] = useState(false);
  const [showOutlookDisconnectDialog, setShowOutlookDisconnectDialog] = useState(false);
  const [showOutlookStopSyncDialog, setShowOutlookStopSyncDialog] = useState(false);
  const [userClosedLogs, setUserClosedLogs] = useState(false);
  
  const { progress, isPolling, startPolling, stopPolling, progressPercentage } = useSyncProgress();

  // Auto-enable polling and show logs if sync is already running
  useEffect(() => {
    if (progress?.isRunning && !isPolling && !userClosedLogs) {
      setShowSyncLogs(true);
      startPolling();
    }
  }, [progress?.isRunning, isPolling, startPolling, userClosedLogs]);

  // Handle OAuth callback success - invalidate cache and show toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outlookStatus = params.get('outlook');
    const gmailStatus = params.get('gmail');

    if (outlookStatus === 'connected') {
      // Invalidate Outlook query to force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/outlook"] });
      toast({
        title: "Outlook Connected",
        description: "Your Outlook account has been successfully connected.",
      });
      // Clean up URL
      params.delete('outlook');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }

    if (gmailStatus === 'connected') {
      // Invalidate Gmail query to force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail"] });
      toast({
        title: "Gmail Connected",
        description: "Your Gmail account has been successfully connected.",
      });
      // Clean up URL
      params.delete('gmail');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [toast]);

  const { data: gmailConfig, isLoading: gmailLoading } = useQuery<any>({ 
    queryKey: ["/api/integrations/gmail"],
  });

  const isGmailConnected = Boolean(
    gmailConfig && gmailConfig.config?.access_token && gmailConfig.isActive !== false
  );

  const { data: outlookConfig, isLoading: outlookLoading } = useQuery<any>({ 
    queryKey: ["/api/integrations/outlook"],
    staleTime: 0, // Always refetch to get latest status
    refetchOnMount: 'always', // Force refetch on component mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const isOutlookConnected = Boolean(
    outlookConfig?.connected && outlookConfig?.isActive !== false
  );

  interface Notification {
    id: string;
    type: string;
    read: boolean;
    metadata?: { 
      newMessageCount?: number;
      threadIds?: string[];
    };
  }

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isGmailConnected || isOutlookConnected,
  });

  const gmailNewLeadsNotifications = notifications.filter(
    (n) => n.type === "gmail_new_leads" && !n.read
  );
  
  const totalNewLeads = gmailNewLeadsNotifications.reduce(
    (sum, n) => sum + (n.metadata?.newMessageCount || 0),
    0
  );

  const outlookNewLeadsNotifications = notifications.filter(
    (n) => n.type === "outlook_new_leads" && !n.read
  );
  
  const totalOutlookNewLeads = outlookNewLeadsNotifications.reduce(
    (sum, n) => sum + (n.metadata?.newMessageCount || 0),
    0
  );

  const integrations: Integration[] = [
    {
      id: "gmail",
      name: "Gmail",
      description: "Sync emails and manage leads directly from your Gmail inbox. Auto-import leads every 5 minutes.",
      icon: <SiGoogle className="h-8 w-8" />,
      status: isGmailConnected ? "configured" : "available",
      category: "Email",
      provider: "google",
    },
    {
      id: "outlook",
      name: "Outlook",
      description: "Sync emails and manage leads directly from your Outlook inbox.",
      icon: <Mail className="h-8 w-8" />,
      status: isOutlookConnected ? "configured" : "available",
      category: "Email",
      provider: "microsoft",
    },
    {
      id: "zillow",
      name: "Zillow",
      description: "List properties on Zillow and automatically capture leads from inquiries",
      icon: <SiZillow className="h-8 w-8" />,
      status: "available",
      category: "Listing Platform",
    },
    {
      id: "apartments",
      name: "Apartments.com",
      description: "Sync property listings and capture leads from Apartments.com",
      icon: <Building2 className="h-8 w-8" />,
      status: "coming-soon",
      category: "Listing Platform",
    },
    {
      id: "realtor",
      name: "Realtor.com",
      description: "Connect your Realtor.com account to manage listings and capture leads",
      icon: <Home className="h-8 w-8" />,
      status: "coming-soon",
      category: "Listing Platform",
    },
    {
      id: "facebook",
      name: "Facebook Messenger",
      description: "Respond to Facebook Messenger inquiries automatically with AI",
      icon: <SiFacebook className="h-8 w-8" />,
      status: "coming-soon",
      category: "Messaging",
    },
    {
      id: "twilio",
      name: "Twilio (SMS & Calls)",
      description: "Handle SMS messages and phone calls with AI-powered responses",
      icon: <Phone className="h-8 w-8" />,
      status: "coming-soon",
      category: "Communication",
    },
    {
      id: "excel",
      name: "Excel Import",
      description: "Import leads and property data from Excel spreadsheets",
      icon: <FileSpreadsheet className="h-8 w-8" />,
      status: "coming-soon",
      category: "Data Import",
    },
  ];

  const connectGmail = async () => {
    try {
      const res = await fetch("/api/integrations/gmail/auth");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
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

  const saveIntegrationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/integrations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail"] });
    },
  });

  const handleStopSync = (deleteLeads: boolean) => {
    cancelSyncMutation.mutate();
    if (isPolling) stopPolling();
    setShowSyncLogs(false);
    setUserClosedLogs(true);
    if (deleteLeads) deleteGmailLeadsMutation.mutate();
    clearSyncProgressMutation.mutate();
    setShowStopSyncDialog(false);
    toast({ 
      title: "Sync stopped", 
      description: deleteLeads ? "Sync stopped and leads deleted" : "Sync stopped, leads preserved" 
    });
  };

  const handleDisconnectGmail = (deleteLeads: boolean) => {
    if (isPolling || progress?.isRunning) cancelSyncMutation.mutate();
    if (isPolling) stopPolling();
    setShowSyncLogs(false);
    setUserClosedLogs(true);
    if (deleteLeads) deleteGmailLeadsMutation.mutate();
    
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
    if (isPolling || progress?.isRunning) {
      setShowDisconnectDialog(true);
    } else {
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
            toast({ title: "Gmail disconnected successfully" });
          }
        }
      );
    }
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
    },
    onError: () => {
      toast({ title: "Failed to sync Gmail messages", variant: "destructive" });
    },
  });

  const syncGmailLeads = () => {
    setShowSyncLogs(true);
    setUserClosedLogs(false);
    startPolling();
    syncGmailMutation.mutate();
  };

  // ===== OUTLOOK HANDLERS =====
  const connectOutlook = async () => {
    try {
      const res = await fetch("/api/integrations/outlook/auth");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({ title: "Failed to initiate Outlook connection", variant: "destructive" });
    }
  };

  const disconnectOutlookMutation = useMutation({
    mutationFn: (deleteLeads: boolean) => 
      apiRequest("POST", "/api/integrations/outlook/disconnect", { deleteLeads }),
    onSuccess: () => {
      toast({ title: "Outlook disconnected successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/outlook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: () => {
      toast({ title: "Failed to disconnect Outlook", variant: "destructive" });
    },
  });

  const disconnectOutlook = () => {
    if (isPolling || progress?.isRunning) {
      setShowOutlookDisconnectDialog(true);
    } else {
      disconnectOutlookMutation.mutate(false);
    }
  };

  const handleDisconnectOutlook = (deleteLeads: boolean) => {
    setShowOutlookDisconnectDialog(false);
    disconnectOutlookMutation.mutate(deleteLeads);
  };

  const handleStopOutlookSync = (deleteLeads: boolean) => {
    setShowOutlookStopSyncDialog(false);
    setShowSyncLogs(false);
    setUserClosedLogs(true);
    stopPolling();
    disconnectOutlookMutation.mutate(deleteLeads);
  };

  const syncOutlookMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/sync-from-outlook", {}),
    onSuccess: (data: any) => {
      const { summary = {}, total = 0 } = data;
      const created = summary.created || 0;
      
      toast({ 
        title: `✅ Outlook Sync Complete!`, 
        description: `Created ${created} new leads from ${total} emails`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
    },
    onError: () => {
      toast({ title: "Failed to sync Outlook messages", variant: "destructive" });
    },
  });

  const syncOutlookLeads = () => {
    setShowSyncLogs(true);
    setUserClosedLogs(false);
    startPolling();
    syncOutlookMutation.mutate();
  };

  // Handle OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      queryClient.refetchQueries({ queryKey: ["/api/integrations/gmail"], type: 'active' });
      toast({ title: "Gmail connected successfully!" });
      window.history.replaceState({}, '', '/integrations');
    }
    if (params.get('outlook') === 'connected') {
      queryClient.refetchQueries({ queryKey: ["/api/integrations/outlook"], type: 'active' });
      toast({ title: "Outlook connected successfully!" });
      window.history.replaceState({}, '', '/integrations');
    }
    if (params.get('outlook') === 'error') {
      const reason = params.get('reason') || 'unknown';
      toast({ 
        title: "Failed to connect Outlook", 
        description: `Error: ${reason}`,
        variant: "destructive" 
      });
      window.history.replaceState({}, '', '/integrations');
    }
  }, []);

  const categorizedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-integrations-title">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="text-integrations-subtitle">
          Connect external services to streamline your property management workflow
        </p>
      </div>

      {Object.entries(categorizedIntegrations).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground/80">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((integration) => (
              <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {integration.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl" data-testid={`text-${integration.id}-name`}>
                          {integration.name}
                        </CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {integration.category}
                        </Badge>
                      </div>
                    </div>
                    {integration.status === "configured" && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-${integration.id}-configured`} />
                    )}
                    {integration.status === "coming-soon" && (
                      <Badge variant="secondary">Coming Soon</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription data-testid={`text-${integration.id}-description`}>
                    {integration.description}
                  </CardDescription>

                  {/* Gmail-specific content */}
                  {integration.id === "gmail" && isGmailConnected && (
                    <>
                      {totalNewLeads > 0 && (
                        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-blue-800 dark:text-blue-200">
                            <strong>{totalNewLeads} new potential leads</strong> detected in your Gmail inbox
                          </AlertDescription>
                        </Alert>
                      )}

                      {showSyncLogs && (
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <RefreshCw className={`h-4 w-4 ${progress?.isRunning ? 'animate-spin' : ''}`} />
                              <span className="text-sm font-medium">
                                {progress?.isRunning ? 'Syncing Gmail...' : 'Sync Complete'}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (progress?.isRunning) {
                                  setShowStopSyncDialog(true);
                                } else {
                                  setShowSyncLogs(false);
                                  setUserClosedLogs(true);
                                }
                              }}
                              data-testid="button-close-sync-logs"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {progress && (
                            <>
                              <Progress value={progressPercentage} className="h-2" />
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Status: {progress.currentStep}</div>
                                {progress.processedEmails > 0 && (
                                  <div>Processed: {progress.processedEmails} / {progress.totalEmails || '?'}</div>
                                )}
                                {progress.summary && (
                                  <div className="mt-2 p-2 rounded bg-background">
                                    <div>Created: {progress.summary.created || 0}</div>
                                    <div>Skipped: {progress.summary.skipped || 0}</div>
                                  </div>
                                )}
                              </div>
                              
                              {progress.logs && progress.logs.length > 0 && (
                                <div className="mt-3 max-h-48 overflow-y-auto rounded bg-black/5 dark:bg-white/5 p-3 font-mono text-xs space-y-0.5">
                                  {progress.logs.map((log: any, idx: number) => {
                                    const logType = log?.type || 'info';
                                    const logMessage = String(log?.message || log || '');
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`
                                          ${logType === 'error' ? 'text-red-600 dark:text-red-400' : ''}
                                          ${logType === 'success' ? 'text-green-600 dark:text-green-400' : ''}
                                          ${logType === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                                          ${logType === 'info' ? 'text-muted-foreground' : ''}
                                        `}
                                      >
                                        {logMessage}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Outlook-specific content */}
                  {integration.id === "outlook" && isOutlookConnected && (
                    <>
                      {totalOutlookNewLeads > 0 && (
                        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertDescription className="text-blue-800 dark:text-blue-200">
                            <strong>{totalOutlookNewLeads} new potential leads</strong> detected in your Outlook inbox
                          </AlertDescription>
                        </Alert>
                      )}

                      {showSyncLogs && (
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <RefreshCw className={`h-4 w-4 ${progress?.isRunning ? 'animate-spin' : ''}`} />
                              <span className="text-sm font-medium">
                                {progress?.isRunning ? 'Syncing Outlook...' : 'Sync Complete'}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (progress?.isRunning) {
                                  setShowOutlookStopSyncDialog(true);
                                } else {
                                  setShowSyncLogs(false);
                                  setUserClosedLogs(true);
                                }
                              }}
                              data-testid="button-close-outlook-sync-logs"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {progress && (
                            <>
                              <Progress value={progressPercentage} className="h-2" />
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Status: {progress.currentStep}</div>
                                {progress.processedEmails > 0 && (
                                  <div>Processed: {progress.processedEmails} / {progress.totalEmails || '?'}</div>
                                )}
                                {progress.summary && (
                                  <div className="mt-2 p-2 rounded bg-background">
                                    <div>Created: {progress.summary.created || 0}</div>
                                    <div>Skipped: {progress.summary.skipped || 0}</div>
                                  </div>
                                )}
                              </div>
                              
                              {progress.logs && progress.logs.length > 0 && (
                                <div className="mt-3 max-h-48 overflow-y-auto rounded bg-black/5 dark:bg-white/5 p-3 font-mono text-xs space-y-0.5">
                                  {progress.logs.map((log: any, idx: number) => {
                                    const logType = log?.type || 'info';
                                    const logMessage = String(log?.message || log || '');
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`
                                          ${logType === 'error' ? 'text-red-600 dark:text-red-400' : ''}
                                          ${logType === 'success' ? 'text-green-600 dark:text-green-400' : ''}
                                          ${logType === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                                          ${logType === 'info' ? 'text-muted-foreground' : ''}
                                        `}
                                      >
                                        {logMessage}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2">
                    {integration.status === "configured" && integration.id === "gmail" ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={syncGmailLeads}
                          disabled={syncGmailMutation.isPending || progress?.isRunning}
                          data-testid="button-gmail-sync"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${(syncGmailMutation.isPending || progress?.isRunning) ? 'animate-spin' : ''}`} />
                          {totalNewLeads > 0 && (
                            <Badge variant="destructive" className="mr-2 h-5 px-1.5">
                              {totalNewLeads}
                            </Badge>
                          )}
                          Sync Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectGmail}
                          disabled={saveIntegrationMutation.isPending}
                          data-testid="button-gmail-disconnect"
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : integration.status === "configured" && integration.id === "outlook" ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={syncOutlookLeads}
                          disabled={syncOutlookMutation.isPending || progress?.isRunning}
                          data-testid="button-outlook-sync"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${(syncOutlookMutation.isPending || progress?.isRunning) ? 'animate-spin' : ''}`} />
                          {totalOutlookNewLeads > 0 && (
                            <Badge variant="destructive" className="mr-2 h-5 px-1.5">
                              {totalOutlookNewLeads}
                            </Badge>
                          )}
                          Sync Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectOutlook}
                          disabled={disconnectOutlookMutation.isPending}
                          data-testid="button-outlook-disconnect"
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : integration.status === "configured" ? (
                      <Button variant="outline" size="sm" data-testid={`button-${integration.id}-manage`}>
                        <SettingsIcon className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    ) : integration.status === "available" ? (
                      <Button 
                        size="sm" 
                        onClick={integration.id === "gmail" ? connectGmail : integration.id === "outlook" ? connectOutlook : undefined}
                        data-testid={`button-${integration.id}-connect`}
                      >
                        Connect
                      </Button>
                    ) : (
                      <Button size="sm" disabled data-testid={`button-${integration.id}-coming-soon`}>
                        Coming Soon
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Need another integration?</CardTitle>
          <CardDescription>
            We're always adding new integrations. Contact support to request a specific platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" data-testid="button-request-integration">
            <Mail className="h-4 w-4 mr-2" />
            Request Integration
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect Gmail Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
            <AlertDialogDescription>
              A sync is currently in progress. What would you like to do with the leads that have been imported?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDisconnectGmail(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Keep Leads & Disconnect
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDisconnectGmail(true)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Leads & Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Sync Dialog */}
      <AlertDialog open={showStopSyncDialog} onOpenChange={setShowStopSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Gmail Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with the leads that have been imported so far?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStopSync(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Keep Leads & Stop
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleStopSync(true)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Leads & Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Outlook Dialog */}
      <AlertDialog open={showOutlookDisconnectDialog} onOpenChange={setShowOutlookDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Outlook?</AlertDialogTitle>
            <AlertDialogDescription>
              A sync is currently in progress. What would you like to do with the leads that have been imported?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDisconnectOutlook(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Keep Leads & Disconnect
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDisconnectOutlook(true)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Leads & Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Outlook Sync Dialog */}
      <AlertDialog open={showOutlookStopSyncDialog} onOpenChange={setShowOutlookStopSyncDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Outlook Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with the leads that have been imported so far?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStopOutlookSync(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Keep Leads & Stop
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleStopOutlookSync(true)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Leads & Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
