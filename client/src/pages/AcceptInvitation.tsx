import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type InvitationDetails = {
  email: string;
  role: string;
  orgName: string;
  inviterName: string;
  status: string;
  expiresAt: string;
  orgHasMembership?: boolean;
  orgId?: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  property_manager: "Property Manager",
  leasing_agent: "Leasing Agent",
  owner_portal: "Owner",
};

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation details
  const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
    queryKey: ["/api/team/invitations/verify", token],
    queryFn: async () => {
      const response = await fetch(`/api/team/invitations/verify/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify invitation");
      }
      return response.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/team/invitations/accept/${token}`);
      return response.json();
    },
    onSuccess: async (data: any) => {
      setAccepted(true);
      
      // Refetch user data to update organization switcher immediately
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Invitation accepted!",
        description: "You've successfully joined the organization.",
      });
      
      // If organization has membership, redirect to /app, otherwise redirect to home
      const orgHasMembership = data?.orgHasMembership === true;
      console.log('[AcceptInvitation] Accept response data:', data);
      console.log('[AcceptInvitation] orgHasMembership:', orgHasMembership);
      
      setTimeout(() => {
        if (orgHasMembership) {
          // Determine redirect path based on environment
          const hostname = window.location.hostname.toLowerCase();
          const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes(':5000');
          const isProduction = hostname.includes('lead2lease.ai');
          const isReplitDev = hostname.includes('.repl.co') || hostname.includes('.replit.dev');
          
          let redirectPath: string;
          if (isLocalhost) {
            // Localhost: use /app path
            redirectPath = "/app";
            console.log('[AcceptInvitation] Localhost detected - redirecting to:', redirectPath);
          } else if (isProduction) {
            // Production: use app.lead2lease.ai (no /app path)
            redirectPath = "https://app.lead2lease.ai";
            console.log('[AcceptInvitation] Production detected - redirecting to:', redirectPath);
          } else if (isReplitDev) {
            // Replit dev: use current domain with /app path
            redirectPath = `${window.location.protocol}//${window.location.host}/app`;
            console.log('[AcceptInvitation] Replit dev detected - redirecting to:', redirectPath);
          } else {
            // Default: use /app path
            redirectPath = "/app";
            console.log('[AcceptInvitation] Default - redirecting to:', redirectPath);
          }
          
          // Use window.location.replace to prevent browser password prompts from blocking navigation
          window.location.replace(redirectPath);
        } else {
          console.log('[AcceptInvitation] Organization does not have membership, redirecting to home');
          // Use window.location.replace to prevent browser password prompts from blocking navigation
          window.location.replace("/");
        }
      }, 1000); // Reduced timeout for faster redirect
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept invitation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (!isAuthenticated) {
      // Store token in sessionStorage and redirect to login
      sessionStorage.setItem("pendingInvitationToken", token || "");
      setLocation(`/login?returnTo=/accept-invitation/${token}`);
      return;
    }

    acceptMutation.mutate();
  };

  // Auto-accept if user is already logged in and returns from login
  useEffect(() => {
    const pendingToken = sessionStorage.getItem("pendingInvitationToken");
    if (isAuthenticated && pendingToken && pendingToken === token && !accepted && !acceptMutation.isPending) {
      sessionStorage.removeItem("pendingInvitationToken");
      acceptMutation.mutate();
    }
  }, [isAuthenticated, token, accepted, acceptMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background light">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 light">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid, expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 light">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Welcome to {invitation.orgName}!</CardTitle>
            <CardDescription>
              You've successfully joined the organization. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 light">
      <Card className="w-full max-w-md" data-testid="card-accept-invitation">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle data-testid="text-invitation-title">You're Invited!</CardTitle>
          <CardDescription>
            {invitation.inviterName} has invited you to join their organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium" data-testid="text-org-name">{invitation.orgName}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Your Role</span>
              <span className="font-medium" data-testid="text-role">
                {ROLE_LABELS[invitation.role] || invitation.role}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium" data-testid="text-email">{invitation.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium text-muted-foreground">
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {isAuthenticated && user?.email !== invitation.email && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Note: This invitation is for <strong>{invitation.email}</strong>, but you're logged in as{" "}
                <strong>{user?.email}</strong>. Please log in with the correct account.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/")}
              data-testid="button-decline"
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={
                acceptMutation.isPending ||
                (isAuthenticated && user?.email !== invitation.email)
              }
              data-testid="button-accept"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : isAuthenticated ? (
                "Accept Invitation"
              ) : (
                "Log In to Accept"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
