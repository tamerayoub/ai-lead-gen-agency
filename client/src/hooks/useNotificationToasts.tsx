import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLeadSheet } from "@/contexts/LeadSheetContext";
import { queryClient } from "@/lib/queryClient";

interface Notification {
  id: string;
  userId: string;
  orgId: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: any;
  read: boolean;
  createdAt: string;
}

/**
 * Hook that monitors for new notifications and shows toast notifications
 */
export function useNotificationToasts() {
  const { toast } = useToast();
  const { openLeadSheet } = useLeadSheet();
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const isInitialized = useRef<boolean>(false); // Track if we've done the initial load

  const { data: notifications = [], isFetched } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Initialize on first successful fetch (regardless of whether notifications are empty)
  // This ensures we don't skip toasts for notifications created shortly after page load
  useEffect(() => {
    if (isFetched && !isInitialized.current) {
      isInitialized.current = true;
      previousNotificationIds.current = new Set(notifications.map(n => n.id));
    }
  }, [isFetched, notifications]);

  useEffect(() => {
    // If we haven't initialized yet (still waiting for first fetch), do nothing
    if (!isInitialized.current) {
      return;
    }
    
    // Find new notifications that weren't in the previous set
    const newNotifications = notifications.filter(
      n => !previousNotificationIds.current.has(n.id) && !n.read
    );

    // If there are new notifications, refresh lead data BEFORE showing toasts
    // This ensures messages appear at the same time as notifications
    if (newNotifications.length > 0) {
      // Invalidate lead queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/unread"] });
      
      // Extract all unique lead IDs from notifications (de-duplicate to avoid redundant refetches)
      const leadIds = Array.from(new Set(
        newNotifications
          .map(n => n.actionUrl?.match(/selected=([^&]+)/)?.[1])
          .filter(Boolean)
      ));
      
      // Invalidate individual lead message queries
      leadIds.forEach(leadId => {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "messages"] });
      });
    }

    // Show toast for each new notification
    newNotifications.forEach(notification => {
      // Extract lead ID from actionUrl (format: /leads?selected=<leadId>)
      const leadId = notification.actionUrl?.match(/selected=([^&]+)/)?.[1];
      
      toast({
        title: notification.title,
        description: notification.message,
        duration: 8000, // Show for 8 seconds
        className: leadId ? "cursor-pointer hover-elevate" : undefined,
        onClick: leadId ? () => openLeadSheet(leadId) : undefined,
      });
    });

    // Update the set with current notification IDs
    previousNotificationIds.current = new Set(notifications.map(n => n.id));
  }, [notifications, toast, openLeadSheet]);
}
