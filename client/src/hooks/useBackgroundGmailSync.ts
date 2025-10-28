import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "./use-toast";

const SYNC_INTERVAL = 1 * 60 * 1000; // 1 minute
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes of inactivity stops syncing

export function useBackgroundGmailSync() {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const syncTimerRef = useRef<NodeJS.Timeout>();
  const activityCheckRef = useRef<NodeJS.Timeout>();

  // Check if Gmail is connected
  const { data: gmailConfig } = useQuery<any>({
    queryKey: ["/api/integrations/gmail"],
  });

  const isGmailConnected = Boolean(
    gmailConfig?.enabled && gmailConfig?.config?.access_token
  );

  const backgroundSyncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/sync-from-gmail", {}),
    onSuccess: (data: any) => {
      const { summary = {} } = data;
      const created = summary.created || 0;
      
      // Always invalidate caches on successful sync
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
      
      // Only show toast if new leads were created
      if (created > 0) {
        toast({ 
          title: `📧 ${created} new lead${created > 1 ? 's' : ''} from Gmail`,
          description: "Background sync completed successfully",
        });
      }
    },
    onError: (error: any) => {
      // Silently log errors, don't disturb user
      console.error("Background Gmail sync failed:", error);
    },
  });

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setIsActive(true);
    };

    // Listen for user interactions
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("scroll", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("scroll", updateActivity);
    };
  }, []);

  // Check for inactivity periodically
  useEffect(() => {
    activityCheckRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > INACTIVITY_TIMEOUT) {
        setIsActive(false);
      }
    }, 60 * 1000); // Check every minute

    return () => {
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, []);

  // Run sync on mount (login/page load)
  useEffect(() => {
    if (!isGmailConnected) return;
    
    // Small delay to let the app fully load
    const initialSyncTimer = setTimeout(() => {
      backgroundSyncMutation.mutate();
    }, 3000);

    return () => clearTimeout(initialSyncTimer);
  }, [isGmailConnected]);

  // Setup periodic sync when active
  useEffect(() => {
    if (!isGmailConnected) return;
    
    if (isActive) {
      syncTimerRef.current = setInterval(() => {
        if (isActive && !backgroundSyncMutation.isPending) {
          backgroundSyncMutation.mutate();
        }
      }, SYNC_INTERVAL);
    } else {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    }

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [isActive, isGmailConnected]);

  return {
    isActive,
    isSyncing: backgroundSyncMutation.isPending,
  };
}
