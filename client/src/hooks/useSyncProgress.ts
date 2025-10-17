import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface SyncLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface SyncProgress {
  isRunning: boolean;
  totalEmails: number;
  processedEmails: number;
  currentStep: string;
  logs: SyncLog[];
  summary?: {
    created: number;
    duplicates: number;
    skipped: number;
    errors: number;
  };
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdLeadIds?: string[]; // Track leads created in this sync
}

export function useSyncProgress(enabled: boolean = false) {
  const [isPolling, setIsPolling] = useState(enabled);

  const { data: progress, refetch } = useQuery<SyncProgress>({
    queryKey: ["/api/leads/sync-progress"],
    enabled: true, // Always enabled to check for running syncs
    refetchInterval: isPolling ? 1000 : false, // Poll every second when active
    refetchIntervalInBackground: true,
    staleTime: 0, // Never use cached data - always fetch fresh
  });

  // Auto-stop polling when sync completes
  useEffect(() => {
    if (progress && !progress.isRunning && progress.completedAt) {
      // Wait a bit then stop polling to show final state
      const timer = setTimeout(() => {
        setIsPolling(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  const startPolling = () => {
    setIsPolling(true);
    refetch();
  };

  const stopPolling = () => {
    setIsPolling(false);
  };

  const getProgressPercentage = () => {
    if (!progress || progress.totalEmails === 0) return 0;
    return Math.round((progress.processedEmails / progress.totalEmails) * 100);
  };

  return {
    progress,
    isPolling,
    startPolling,
    stopPolling,
    progressPercentage: getProgressPercentage(),
    refetch,
  };
}
