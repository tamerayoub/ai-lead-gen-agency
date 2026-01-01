import { useEffect, useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Crown,
  CheckCircle,
  Mail,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function SuccessContent() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { hasCompletedOnboarding, refetch: refetchMembership } = useMembership();
  const queryClient = useQueryClient();
  const sessionId = new URLSearchParams(search).get("session_id");
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{
    status: string;
    customerEmail: string;
    customerName: string;
    amount: number;
    orgId?: string;
    orgCreatedForCheckout?: boolean;
  } | null>(null);

  // Check if user has properties (alternative indicator of onboarding completion)
  // For new organizations created during checkout, we need to check properties for that specific org
  const { data: properties } = useQuery<Array<{ id: string }>>({
    queryKey: ["/api/properties"],
    enabled: isAuthenticated,
    staleTime: 0, // Always fetch fresh
  });

  // Fetch founding partner price from Stripe
  const { data: priceData } = useQuery<{
    productId: string | null;
    priceId: string | null;
    amount: number;
    currency: string;
    interval: string;
    formattedAmount: string;
  }>({
    queryKey: ["/api/stripe/founding-partner-price"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
  
  const displayPrice = priceData?.formattedAmount || "149.99";

  const hasProperties = (properties?.length ?? 0) > 0;
  
  // For new organizations created during checkout, always require onboarding
  // Check if org was created during checkout OR if org has no properties yet
  const isNewOrg = sessionData?.orgCreatedForCheckout === true || (!hasProperties && sessionData?.orgId);
  const actuallyCompletedOnboarding = isNewOrg ? false : (hasCompletedOnboarding || hasProperties);

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/stripe/session/${sessionId}`, {
        credentials: 'include', // Include session cookie to preserve authentication
      })
        .then((res) => res.json())
        .then(async (data) => {
          setSessionData(data);
          setIsLoading(false);
          
          // If user is logged in, immediately try to link subscription
          if (isAuthenticated && user?.email) {
            linkSubscription();
          } else if (data.customerEmail) {
            // User is not authenticated but we have their email from Stripe
            // Try to refresh auth status - session might still be valid
            try {
              const authCheck = await fetch('/api/auth/user', {
                credentials: 'include',
              });
              if (authCheck.ok) {
                const userData = await authCheck.json();
                // If we got user data, the session is still valid, just refresh the auth state
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                // Wait a moment for the query to update, then try linking
                setTimeout(() => {
                  if (userData?.email === data.customerEmail) {
                    linkSubscription();
                  }
                }, 500);
              }
            } catch (authErr) {
              console.log("[Success Page] User not authenticated, will need to log in");
            }
          }
        })
        .catch((err) => {
          console.error("Failed to fetch session:", err);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [sessionId, isAuthenticated, user, queryClient]);

  // Removed auto-redirect - user should see the success page first
  // They can click "Continue to Lead2Lease" button when ready

  // Refetch membership status and properties when subscription is linked
  useEffect(() => {
    if (linkStatus === 'active' && isAuthenticated) {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      refetchMembership();
      
      // If we have an orgId from the session, switch to that organization
      if (sessionData?.orgId) {
        switchToOrganization(sessionData.orgId);
      }
      
      // Don't auto-redirect - let user see success page and click button when ready
    }
  }, [linkStatus, isAuthenticated, queryClient, refetchMembership, sessionData?.orgId]);

  const linkSubscription = async () => {
    if (!isAuthenticated || !user?.email) return;
    
    setIsLinking(true);
    setLinkStatus(null);
    
    try {
      const response = await fetch('/api/membership/link-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookie
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLinkStatus('success');
        // Poll membership status to verify it's active
        pollMembershipStatus();
      } else {
        setLinkStatus('failed');
        console.error('Failed to link subscription:', data.message);
      }
    } catch (error) {
      console.error('Error linking subscription:', error);
      setLinkStatus('error');
    } finally {
      setIsLinking(false);
    }
  };

  const pollMembershipStatus = async (attempts = 0) => {
    if (attempts >= 10) return; // Stop after 10 attempts (10 seconds)
    
    try {
      // Invalidate and refetch membership status to get fresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
      await refetchMembership();
      
      const response = await fetch('/api/membership/status', {
        credentials: 'include', // Include session cookie
      });
      const data = await response.json();
      
      if (data.isFoundingPartner) {
        setLinkStatus('active');
        // Invalidate all related queries to ensure fresh data
        await queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
        // Don't reload - let the useEffect handle the redirect
      } else {
        // Poll again after 1 second
        setTimeout(() => pollMembershipStatus(attempts + 1), 1000);
      }
    } catch (error) {
      console.error('Error checking membership status:', error);
    }
  };

  const switchToOrganization = async (orgId: string) => {
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgId }),
      });
      
      if (response.ok) {
        console.log(`[Success Page] Switched to organization ${orgId}`);
        // Invalidate queries to refresh org context
        queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
        queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
      }
    } catch (error) {
      console.error('[Success Page] Error switching organization:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: '#FFDF00' }} />
          <p className="text-gray-600">Confirming your purchase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-2 flex items-center justify-center">
          <Link href="/">
            <img src={logoBlack} alt="Lead2Lease" className="h-8 w-auto cursor-pointer" />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-3 md:py-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-3 md:mb-4">
            <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2 md:mb-3">
              <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-green-600" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-1 md:mb-2 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 bg-clip-text text-transparent">
              Welcome to the Founding Partners!
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Your purchase was successful. You're now part of an exclusive group shaping the future of Lead2Lease.
            </p>
          </div>

          <Card className="border-2 shadow-xl mb-3 md:mb-4" style={{ borderColor: 'rgba(255, 223, 0, 0.3)' }} data-testid="card-confirmation">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Crown className="h-5 w-5 md:h-6 md:w-6" style={{ color: '#FFDF00' }} />
                <span className="text-lg md:text-xl font-bold" style={{ color: '#CCB300' }}>Founding Partner</span>
              </div>

              <div className="rounded-lg p-2.5 md:p-3 mb-3 text-center" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)' }}>
                <p className="text-sm md:text-base font-semibold" style={{ color: '#CCB300' }}>${displayPrice} upfront</p>
                <p className="text-xs" style={{ color: '#CCB300' }}>Monthly recurring payment begins post-launch</p>
              </div>

              <div className="mb-3">
                <h3 className="font-semibold text-gray-900 text-sm md:text-base mb-2 text-left">What happens next?</h3>
                <div className="grid grid-cols-1 gap-2 text-left">
                  <div className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)' }}>
                      <Mail className="h-2.5 w-2.5" style={{ color: '#CCB300' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs md:text-sm font-medium block">Check your email</span>
                      <p className="text-xs text-gray-600">You'll receive a confirmation with your subscription details and login info</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)' }}>
                      <Sparkles className="h-2.5 w-2.5" style={{ color: '#CCB300' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs md:text-sm font-medium block">White-glove onboarding</span>
                      <p className="text-xs text-gray-600">Our team will reach out to schedule your exclusive onboarding session</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)' }}>
                      <Crown className="h-2.5 w-2.5" style={{ color: '#CCB300' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs md:text-sm font-medium block">Direct founder access</span>
                      <p className="text-xs text-gray-600">You'll get a private channel to share feedback and feature requests</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAuthenticated ? (
            <>
              {isLinking && (
                <div className="mb-2 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" style={{ color: '#FFDF00' }} />
                  <p className="text-xs text-gray-600">Linking your subscription...</p>
                </div>
              )}
              {linkStatus === 'success' && (
                <div className="mb-2 text-center">
                  <p className="text-xs text-green-600">Subscription linked! Verifying membership...</p>
                </div>
              )}
              {linkStatus === 'active' && (
                <div className="mb-2 text-center">
                  <p className="text-xs text-green-600 font-semibold">✅ Membership activated! You now have full access.</p>
                </div>
              )}
              {linkStatus === 'failed' && (
                <div className="mb-2 text-center">
                  <p className="text-xs" style={{ color: '#CCB300' }}>Subscription may take a few moments to activate. If issues persist, please contact support.</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={linkSubscription}
                    className="mt-1 text-xs"
                  >
                    Retry Linking
                  </Button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center mb-2">
                {actuallyCompletedOnboarding && !isNewOrg ? (
                  <Button 
                    size="default" 
                    className="text-white hover:opacity-90 text-sm" 
                    style={{ backgroundColor: '#FFDF00' }} 
                    data-testid="button-continue-to-app"
                    onClick={async () => {
                      // If authenticated, go directly to /app and switch to the org that got the membership
                      if (isAuthenticated) {
                        // Switch to the organization that got the membership if we have the orgId
                        if (sessionData?.orgId) {
                          await switchToOrganization(sessionData.orgId);
                        }
                        // Refresh membership status before redirecting
                        await queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
                        await queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
                        await refetchMembership();
                        // Check if on marketing domain - if so, redirect to app subdomain
                        const hostname = window.location.hostname.toLowerCase();
                        const isMarketingDomain = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
                        
                        if (isMarketingDomain) {
                          console.log('[FoundingPartnerSuccess] On marketing domain, redirecting to app subdomain');
                          window.location.href = 'https://app.lead2lease.ai';
                        } else {
                          // On app domain or local dev - use relative path
                          setLocation('/app');
                        }
                      } else {
                        // Not authenticated - route through login
                        const emailParam = sessionData?.customerEmail 
                          ? `&email=${encodeURIComponent(sessionData.customerEmail)}` 
                          : '';
                        // Check if on marketing domain - if so, redirect to app subdomain for login
                        const hostname = window.location.hostname.toLowerCase();
                        const isMarketingDomain = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
                        
                        if (isMarketingDomain) {
                          window.location.href = `https://app.lead2lease.ai/login?returnTo=/app${emailParam}`;
                        } else {
                          setLocation(`/login?returnTo=/app${emailParam}`);
                        }
                      }
                    }}
                  >
                    Continue to Lead2Lease
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    size="default" 
                    className="text-white hover:opacity-90 text-sm" 
                    style={{ backgroundColor: '#FFDF00' }} 
                    data-testid="button-continue-to-onboarding"
                    onClick={async () => {
                      // Always check authentication status before redirecting
                      try {
                        const authCheck = await fetch('/api/auth/user', {
                          credentials: 'include',
                        });
                        if (authCheck.ok) {
                          const userData = await authCheck.json();
                          if (userData?.id) {
                            // Switch to the organization that got the membership if we have the orgId
                            if (sessionData?.orgId) {
                              await switchToOrganization(sessionData.orgId);
                            }
                            // Refresh membership status and org context before redirecting
                            await queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
                            await refetchMembership();
                            // User is authenticated, proceed to /onboarding for new org
                            setLocation("/onboarding");
                            return;
                          }
                        }
                      } catch (err) {
                        console.log("[Success Page] Auth check failed, redirecting to login");
                      }
                      
                      // User is not authenticated, redirect to login with returnTo and email hint
                      const emailParam = sessionData?.customerEmail 
                        ? `&email=${encodeURIComponent(sessionData.customerEmail)}` 
                        : '';
                      setLocation(`/login?returnTo=/onboarding${emailParam}`);
                    }}
                  >
                    Continue to Onboarding
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Link href="/">
                  <Button size="default" variant="outline" className="text-sm" data-testid="button-back-home">
                    Return to Home
                  </Button>
                </Link>
              </div>
            </>
          ) : (
              <div className="space-y-3">
              <div className="rounded-lg p-3 text-center border" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                <p className="text-xs mb-2" style={{ color: '#CCB300' }}>
                  To activate your membership, please log in or create an account with the email you used for payment ({sessionData?.customerEmail || 'your payment email'}).
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button 
                    size="default" 
                    className="text-white hover:opacity-90 text-sm" 
                    style={{ backgroundColor: '#FFDF00' }}
                    onClick={() => {
                      // Redirect to login with returnTo parameter pointing to /onboarding for new orgs
                      // or /app if org already completed onboarding
                      const redirectTo = (actuallyCompletedOnboarding && !isNewOrg) ? '/app' : '/onboarding';
                      setLocation(`/login?returnTo=${encodeURIComponent(redirectTo)}`);
                    }}
                  >
                    Log In
                  </Button>
                  {/* <Link href="/register">
                    <Button size="default" variant="outline" className="text-sm">
                      Create Account
                    </Button>
                  </Link> */}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/">
                  <Button size="default" variant="outline" className="text-sm" data-testid="button-back-home">
                    Return to Home
                  </Button>
                </Link>
              </div>
            </div>
          )}


          <p className="mt-2 text-xs text-gray-500">
            Questions? Contact us at{" "}
            <a href="mailto:support@lead2lease.ai" className="hover:underline" style={{ color: '#CCB300' }}>
              support@lead2lease.ai
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function FoundingPartnerSuccess() {
  return (
    <ThemeProvider forcedTheme="light">
      <SuccessContent />
    </ThemeProvider>
  );
}
