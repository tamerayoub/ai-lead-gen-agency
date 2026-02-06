import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Power, PowerOff, RefreshCw, Bot, User, MessageSquare, Loader2, Send, Clock, Calendar } from "lucide-react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AIAutoPilot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLead, setCurrentLead] = useState<any>(null);
  const [currentReply, setCurrentReply] = useState<string>("");
  const [processingHistory, setProcessingHistory] = useState<Array<{
    leadId: string;
    leadName: string;
    leadMessage: string;
    aiReply: string;
    sent: boolean;
    timestamp: string;
    channel?: string;
  }>>([]);

  // Fetch persisted activity logs from database
  const { data: persistedLogs, refetch: refetchLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["/api/ai-autopilot/activity-logs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-autopilot/activity-logs?limit=200");
      if (!res.ok) {
        // If table doesn't exist yet, return empty array instead of throwing
        if (res.status === 500) {
          const error = await res.json().catch(() => ({}));
          if (error.message?.includes('does not exist')) {
            return [];
          }
        }
        throw new Error("Failed to fetch activity logs");
      }
      const logs = await res.json();
      // Transform database logs to match component format
      return logs.map((log: any) => ({
        leadId: log.leadId,
        leadName: log.leadName,
        leadMessage: log.leadMessage,
        aiReply: log.aiReply,
        sent: log.sent,
        timestamp: log.createdAt,
        channel: log.channel,
      }));
    },
    refetchInterval: 15000, // Refetch every 15 seconds to keep activity log updated
    staleTime: 5000, // Consider data stale after 5 seconds
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour (formerly cacheTime)
  });

  // Load persisted logs on mount and when they change
  useEffect(() => {
    if (!isLoadingLogs && persistedLogs) {
      // Always set persisted logs as the base, then merge with any local-only entries
      setProcessingHistory(prev => {
        // Create a set of persisted log IDs for deduplication
        const persistedIds = new Set(
          persistedLogs.map((log: any) => `${log.leadId}-${log.timestamp}`)
        );
        
        // Keep only local entries that aren't in persisted logs (avoid duplicates)
        const localOnly = prev.filter(
          item => !persistedIds.has(`${item.leadId}-${item.timestamp}`)
        );
        
        // Combine: persisted logs first (newest), then local-only entries
        const combined = [...persistedLogs, ...localOnly].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        return combined;
      });
    }
  }, [persistedLogs, isLoadingLogs]);

  // Fetch auto-pilot status
  const { data: autoPilotStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/ai-autopilot/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-autopilot/status");
      if (!res.ok) throw new Error("Failed to fetch auto-pilot status");
      return res.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch unreplied leads
  const { data: unrepliedLeads, refetch: refetchLeads } = useQuery({
    queryKey: ["/api/ai-autopilot/unreplied-leads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-autopilot/unreplied-leads");
      if (!res.ok) throw new Error("Failed to fetch unreplied leads");
      return res.json();
    },
    refetchInterval: autoPilotStatus?.enabled ? 10000 : false, // Poll every 10 seconds when enabled
  });

  // Fetch auto-pilot metrics
  // Use keepPreviousData to maintain last successfully fetched state even if new fetch fails
  const { data: metrics, refetch: refetchMetrics, error: metricsError } = useQuery({
    queryKey: ["/api/ai-autopilot/metrics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-autopilot/metrics");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch metrics");
      }
      const data = await res.json();
      console.log("[Auto-Pilot] Metrics fetched:", data);
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 2, // Retry failed requests
    placeholderData: keepPreviousData, // Keep showing last successful data if fetch fails
  });

  // Toggle auto-pilot mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/ai-autopilot/toggle", { enabled });
      if (!res.ok) throw new Error("Failed to toggle auto-pilot");
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autopilot/status"] });
      toast({
        title: autoPilotStatus?.enabled ? "Auto-pilot disabled" : "Auto-pilot enabled",
        description: autoPilotStatus?.enabled 
          ? "AI Leasing Agent will no longer automatically respond to leads"
          : "AI Leasing Agent will now automatically respond to unreplied leads",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle auto-pilot",
        variant: "destructive",
      });
    },
  });

  // Process one lead mutation
  const processLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/ai-autopilot/process-lead/${leadId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process lead");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Add to processing history temporarily (will be replaced by persisted logs)
      const newEntry = {
        leadId: data.leadId,
        leadName: data.leadName,
        leadMessage: data.leadMessage,
        aiReply: data.aiReply,
        sent: data.sent,
        timestamp: new Date().toISOString(),
        channel: data.channel || 'email',
      };
      setProcessingHistory(prev => [newEntry, ...prev]);
      
      // Refetch persisted logs to get the latest from database (includes the new entry)
      // This ensures the activity log is always in sync with the database
      setTimeout(() => {
        refetchLogs();
        refetchMetrics(); // Also refresh metrics when a new message is sent
      }, 500); // Small delay to ensure database write is complete

      // Wait 0.25 seconds before clearing current lead to allow user to see the sent message
      setTimeout(() => {
        // Clear current lead and reply
        setCurrentLead(null);
        setCurrentReply("");
      }, 250);

      // Refetch unreplied leads
      refetchLeads();

      toast({
        title: data.sent ? "Reply sent successfully" : "Reply generated (pending send)",
        description: `AI replied to ${data.leadName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process lead",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Auto-process leads when enabled
  useEffect(() => {
    if (autoPilotStatus?.enabled && unrepliedLeads && unrepliedLeads.length > 0 && !isProcessing) {
      // Find the first unreplied lead that isn't currently being processed
      const nextLead = unrepliedLeads.find((lead: any) => 
        !processingHistory.some(h => h.leadId === lead.id && 
          new Date(h.timestamp).getTime() > Date.now() - 5000) // Not processed in last 5 seconds
      );

      if (nextLead) {
        setIsProcessing(true);
        setCurrentLead(nextLead);
        setCurrentReply(""); // Clear previous reply
        
        // Process the lead
        processLeadMutation.mutate(nextLead.id, {
          onSettled: () => {
            // Wait 0.25 seconds after processing completes before allowing next lead
            // This gives time to see the sent message before moving to next
            setTimeout(() => {
              setIsProcessing(false);
            }, 250);
          },
        });
      }
    }
  }, [autoPilotStatus?.enabled, unrepliedLeads, isProcessing, processingHistory]);

  // Update current reply when processing
  useEffect(() => {
    if (processLeadMutation.isPending && currentLead) {
      setCurrentReply("Generating AI response...");
    } else if (processLeadMutation.data) {
      setCurrentReply(processLeadMutation.data.aiReply || "");
    }
  }, [processLeadMutation.isPending, processLeadMutation.data, currentLead]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Auto-Pilot</h1>
        <p className="text-muted-foreground mt-1">Automatically respond to unreplied leads and handle follow-ups</p>
      </div>

      {/* Metrics/KPIs Row */}
      {metricsError && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Unable to refresh metrics. Showing last known values.
          </p>
        </div>
      )}
      {/* Failed-messages note hidden: "failed" count includes pending/scheduled messages sent by the time service; do not show as failures */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Messages Sent</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics?.totalMessagesSent ?? 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent Today</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics?.messagesSentToday ?? 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics?.avgResponseTimeMinutes && metrics.avgResponseTimeMinutes > 0
                    ? `${metrics.avgResponseTimeMinutes}m`
                    : 'N/A'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inquiry to Tour</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics?.avgInquiryToTourDays && metrics.avgInquiryToTourDays > 0
                    ? `${metrics.avgInquiryToTourDays}d`
                    : 'N/A'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Auto-Pilot AI Leasing Agent</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and automatically respond to leads in real-time
              </p>
            </div>
            <Button
              onClick={() => toggleMutation.mutate(!autoPilotStatus?.enabled)}
              disabled={toggleMutation.isPending}
              variant={autoPilotStatus?.enabled ? "destructive" : "default"}
            >
              {toggleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : autoPilotStatus?.enabled ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Turn Off
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Turn On
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${autoPilotStatus?.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <div>
                <p className="text-sm font-medium">
                  {autoPilotStatus?.enabled ? "Auto-Pilot Active" : "Auto-Pilot Inactive"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {autoPilotStatus?.enabled 
                    ? `Monitoring ${unrepliedLeads?.length || 0} unreplied leads`
                    : "Turn on to start automatically responding to leads"}
                </p>
              </div>
            </div>
            {unrepliedLeads && unrepliedLeads.length > 0 && (
              <Badge variant="secondary">{unrepliedLeads.length} unreplied</Badge>
            )}
          </div>

          {/* Monitoring View */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Live Monitoring</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchLeads()}
                  disabled={isProcessing}
                >
                  <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {currentLead ? (
              <div className="p-6 space-y-4">
                {/* Lead Message (Left) */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{currentLead.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {currentLead.channel || 'email'}
                      </Badge>
                    </div>
                    <div className="bg-muted rounded-lg p-4 border">
                      <p className="text-sm whitespace-pre-wrap">{currentLead.lastIncomingMessage}</p>
                    </div>
                  </div>
                </div>

                {/* AI Response (Right) */}
                <div className="flex gap-4">
                  <div className="flex-1 flex justify-end">
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-2 mb-2 justify-end">
                        <span className="text-sm font-medium">AI Leasing Agent</span>
                        <Bot className="h-4 w-4 text-primary" />
                        {processLeadMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                        {processLeadMutation.isPending ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating response...
                          </div>
                        ) : currentReply ? (
                          <p className="text-sm whitespace-pre-wrap">{currentReply}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Waiting for AI response...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {autoPilotStatus?.enabled
                    ? unrepliedLeads && unrepliedLeads.length > 0
                      ? "Waiting for next unreplied lead..."
                      : "No unreplied leads at the moment"
                    : "Turn on Auto-Pilot to start monitoring and responding to leads"}
                </p>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Activity Log - Always visible at the bottom */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Activity Log</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                History of all auto-pilot messages sent to leads
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {processingHistory.length} {processingHistory.length === 1 ? 'entry' : 'entries'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchLogs()}
                disabled={isLoadingLogs}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading activity log...</span>
            </div>
          ) : processingHistory.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Activity will appear here once auto-pilot starts processing leads.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-4">
                {processingHistory.map((item, idx) => {
                  // Truncate messages if too long (show first 200 chars with ellipsis)
                  const truncateMessage = (text: string, maxLength: number = 200) => {
                    if (!text) return 'N/A';
                    if (text.length <= maxLength) return text;
                    return text.substring(0, maxLength) + '...';
                  };
                  
                  return (
                    <div key={`${item.leadId}-${item.timestamp}-${idx}`} className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.leadName}</span>
                          <Badge variant={item.sent ? "default" : "secondary"} className="text-xs">
                            {item.sent ? "Sent" : "Pending"}
                          </Badge>
                          {item.channel && (
                            <Badge variant="outline" className="text-xs">
                              {item.channel}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Lead Message:</p>
                          <div className="bg-muted rounded p-3 border">
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {truncateMessage(item.leadMessage)}
                            </p>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">AI Response:</p>
                          <div className="bg-primary/10 rounded p-3 border border-primary/20">
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {truncateMessage(item.aiReply)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

