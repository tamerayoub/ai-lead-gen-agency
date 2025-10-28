import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLeadSheet } from "@/contexts/LeadSheetContext";
import { formatDistanceToNow } from "date-fns";

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

export function NotificationBell() {
  const { openLeadSheet } = useLeadSheet();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 10000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("DELETE", `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    setOpen(false);
    if (notification.actionUrl) {
      // Extract lead ID from actionUrl (format: /leads?selected=<leadId>)
      const leadId = notification.actionUrl.match(/selected=([^&]+)/)?.[1];
      if (leadId) {
        openLeadSheet(leadId);
      }
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {(unreadCount?.count ?? 0) > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full min-w-[1.25rem] min-h-[1.25rem] flex items-center justify-center text-xs font-medium px-1"
              data-testid="badge-unread-count"
            >
              {unreadCount?.count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold" data-testid="text-notifications-title">Notifications</h3>
          {notifications.length > 0 && (
            <Badge variant="secondary" data-testid="badge-total-count">
              {notifications.length}
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground" data-testid="text-loading">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" data-testid="text-no-notifications">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {unreadNotifications.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                    Unread
                  </div>
                  {unreadNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 hover-elevate cursor-pointer bg-accent/10"
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" data-testid={`notification-title-${notification.id}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`notification-message-${notification.id}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(notification.id);
                          }}
                          data-testid={`button-delete-${notification.id}`}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {readNotifications.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50">
                    Read
                  </div>
                  {readNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 hover-elevate cursor-pointer opacity-60"
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" data-testid={`notification-title-${notification.id}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`notification-message-${notification.id}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(notification.id);
                          }}
                          data-testid={`button-delete-${notification.id}`}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
