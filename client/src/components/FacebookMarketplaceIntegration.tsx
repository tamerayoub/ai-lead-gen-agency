/**
 * Facebook Marketplace Integration Component
 * Uses server-persisted sessions (Playwright storageState) for reliable connection status
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FacebookStatus {
  connected: boolean;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  accountIdentifier?: string | null;
}

export function FacebookMarketplaceIntegration() {
  const { toast } = useToast();
  
  // State
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Fetch status from server (persisted)
  const { data: status, isLoading, refetch } = useQuery<FacebookStatus>({
    queryKey: ["/api/integrations/facebook/status"],
    queryFn: async () => {
      const response = await fetch("/api/integrations/facebook/status");
      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }
      return response.json();
    },
    staleTime: 30000, // Refetch every 30s to keep status fresh
    refetchInterval: 30000,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/integrations/facebook/connect", {
        email,
        password,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Facebook Marketplace Connected",
          description: data.accountIdentifier
            ? `Connected as ${data.accountIdentifier}`
            : "Your session has been saved successfully.",
        });
        setShowConfigDialog(false);
        setEmail("");
        setPassword("");
        queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to Facebook Marketplace",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/integrations/facebook/verify", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Session Verified",
          description: "Your Facebook session is still valid.",
        });
      } else {
        toast({
          title: "Session Invalid",
          description: data.error || "Please reconnect to Facebook Marketplace",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Could not verify session",
        variant: "destructive",
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/integrations/facebook/disconnect", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Facebook Marketplace Disconnected",
        description: "Your session has been removed.",
      });
      setShowDisconnectDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Could not disconnect",
        variant: "destructive",
      });
    },
  });

  // Handle connect button click
  const handleConnect = () => {
    if (!email || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate({ email, password });
  };

  // Format last verified date
  const formatLastVerified = (date: string | null | undefined) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      return d.toLocaleString();
    } catch {
      return null;
    }
  };

  return (
    <>
      {/* Facebook Marketplace Integration Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <SiFacebook className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">Facebook Marketplace</h3>
                  {isLoading ? (
                    <Badge variant="outline">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </Badge>
                  ) : status?.connected ? (
                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Connected</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Facebook account to manage marketplace listings and messages
                </p>

                {/* Connection status info */}
                {status?.connected && (
                  <Alert className="mt-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      <strong>Connected</strong>
                      {status.accountIdentifier && ` as ${status.accountIdentifier}`}
                      {status.lastVerifiedAt && (
                        <span className="block text-xs mt-1 opacity-70">
                          Last verified: {formatLastVerified(status.lastVerifiedAt)}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error info */}
                {status?.lastError && !status?.connected && (
                  <Alert className="mt-3" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {status.lastError}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Info about session persistence */}
                {!status?.connected && (
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Your Facebook session will be saved securely on the server and persist across refreshes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 ml-4">
              {status?.connected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Verify
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDisconnectDialog(true)}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <AlertDialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect Facebook Marketplace</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your Facebook credentials to connect. Your session will be saved securely and persist across refreshes.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fb-email">Email</Label>
              <Input
                id="fb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-email@example.com"
                disabled={connectMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-password">Password</Label>
              <div className="relative">
                <Input
                  id="fb-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Facebook password"
                  disabled={connectMutation.isPending}
                  className={password ? "pr-10" : ""}
                />
                {password && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your credentials are stored encrypted and only used to establish a session. They are never shown or sent to the UI again.
              </AlertDescription>
            </Alert>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={connectMutation.isPending}
              onClick={() => {
                setEmail("");
                setPassword("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConnect}
              disabled={!email || !password || connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Facebook Marketplace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your saved Facebook session. You'll need to reconnect to use Facebook Marketplace features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
