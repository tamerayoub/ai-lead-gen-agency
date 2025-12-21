import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Crown,
  CheckCircle,
  Building2,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";

function OnboardingContent() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session_id");
  
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionData, setSessionData] = useState<{
    customerEmail: string;
    customerName: string;
  } | null>(null);

  // Verify the checkout session
  useEffect(() => {
    if (sessionId) {
      fetch(`/api/stripe/session/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'paid') {
            setSessionValid(true);
            setSessionData({
              customerEmail: data.customerEmail,
              customerName: data.customerName || '',
            });
          }
          setIsVerifying(false);
        })
        .catch((err) => {
          console.error("Failed to verify session:", err);
          setIsVerifying(false);
        });
    } else {
      // Check if user has a pending subscription
      fetch('/api/pending-subscription/check')
        .then((res) => res.json())
        .then((data) => {
          if (data.hasPending) {
            setSessionValid(true);
            setSessionData({
              customerEmail: data.email || user?.email || '',
              customerName: data.name || '',
            });
          }
          setIsVerifying(false);
        })
        .catch(() => {
          setIsVerifying(false);
        });
    }
  }, [sessionId, user]);

  // Pre-fill company name from user data
  useEffect(() => {
    if (user?.company && !companyName) {
      setCompanyName(user.company);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter your company or organization name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/founding-partner/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyName: companyName.trim(),
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      toast({
        title: "Organization created!",
        description: "Now let's gather some details about your business.",
      });

      // Invalidate all queries to refresh membership status and org data
      await queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });

      // Redirect to full onboarding flow to gather organization details
      setIsLoading(false);
      setLocation('/onboarding');
    } catch (error: any) {
      console.error("Onboarding error:", error);
      // If setup fails, redirect to onboarding flow instead of showing error
      toast({
        title: "Redirecting to onboarding",
        description: "Please complete the onboarding questions to continue.",
      });
      setIsLoading(false);
      // Redirect to onboarding after a brief delay
      setTimeout(() => {
        setLocation('/onboarding');
      }, 1000);
    }
  };

  // Loading state
  if (authLoading || isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b to-white flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), white)' }}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#FFDF00' }} />
          <p className="text-gray-600">Verifying your purchase...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - should not happen but handle it
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b to-white flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), white)' }}>
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">Please sign in to complete your setup.</p>
            <Button 
              onClick={() => window.location.href = `/__repl_auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No valid session
  if (!sessionValid && !isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b to-white flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), white)' }}>
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              We couldn't verify your purchase. Please try again or contact support.
            </p>
            <Button onClick={() => setLocation('/founding-partner-checkout')}>
              Return to Checkout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b to-white" style={{ background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), white)' }}>
      <header className="border-b border-gray-200/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <img src={logoBlack} alt="Lead2Lease" className="h-10 w-auto" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto">
          <div className="mb-8 text-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
              <Crown className="h-4 w-4" />
              <span className="text-sm font-semibold">Purchase Successful!</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">
              Welcome, Founding Partner!
            </h1>
            <p className="text-gray-600">
              Just one more step - let's set up your organization.
            </p>
          </div>

          <Card className="shadow-xl" data-testid="card-onboarding-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: '#FFDF00' }} />
                Your Organization
              </CardTitle>
              <CardDescription>
                This will be the name of your company or organization in Lead2Lease.
                You can always change it later in settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company / Organization Name</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Acme Property Management"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    data-testid="input-company-name"
                  />
                  <p className="text-xs text-gray-500">
                    This is how your organization will appear in the app.
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: '#FFDF00' }}
                  disabled={isLoading || !companyName.trim()}
                  data-testid="button-complete-setup"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {sessionData?.customerEmail && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Logged in as {sessionData.customerEmail}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function FoundingPartnerOnboarding() {
  return (
    <ThemeProvider forcedTheme="light">
      <OnboardingContent />
    </ThemeProvider>
  );
}
