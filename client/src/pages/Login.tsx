import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Building2, Mail, ArrowLeft, Bot, Calendar, BarChart3, Home } from "lucide-react";
import logo from "@/assets/lead2lease-logo-black.svg";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isDevEnvironment, isProductionApp, isProductionMarketing, getPostLoginRedirect } from "@/lib/appUrls";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Helper function to get home URL - redirects to marketing domain if on app subdomain
function getHomeUrl(): string {
  if (typeof window === 'undefined') return '/';
  
  // Dev environments - stay on current domain
  if (isDevEnvironment()) {
    return '/';
  }
  
  // Production app subdomain - go to marketing domain
  if (isProductionApp()) {
    return 'https://lead2lease.ai';
  }
  
  return '/';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check for OAuth error, onboarding token, returnTo, and email in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const token = params.get("onboardingToken");
    const returnToParam = params.get("returnTo");
    const emailParam = params.get("email");
    
    if (token) {
      setOnboardingToken(token);
    }
    
    if (returnToParam) {
      // Decode the returnTo parameter (it might be URL encoded)
      const decodedReturnTo = decodeURIComponent(returnToParam);
      console.log('[Login] Found returnTo parameter:', returnToParam, 'decoded:', decodedReturnTo);
      setReturnTo(decodedReturnTo);
    }
    
    // If email is provided (e.g., from Stripe checkout success), pre-fill it
    if (emailParam) {
      form.setValue("email", emailParam);
      // Show a helpful message
      toast({
        title: "Please sign in to continue",
        description: `Sign in with ${emailParam} to access your account after completing your purchase.`,
      });
    }
    
    if (error) {
      // Decode the error message (it's URL encoded)
      const decodedError = decodeURIComponent(error);
      
      toast({
        title: "Authentication failed",
        description: decodedError,
        variant: "destructive",
      });
      
      // Clear error from URL (but keep other params)
      const newParams = new URLSearchParams();
      if (token) newParams.set("onboardingToken", token);
      if (returnToParam) newParams.set("returnTo", returnToParam);
      if (emailParam) newParams.set("email", emailParam);
      const newUrl = newParams.toString() ? `/login?${newParams.toString()}` : "/login";
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast, form]);

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsLoading(true);
      console.log('[Login] ===== STARTING LOGIN PROCESS =====');
      console.log('[Login] Current window location:', window.location.href);
      console.log('[Login] Current hostname:', window.location.hostname);
      console.log('[Login] Current protocol:', window.location.protocol);
      console.log('[Login] Environment:', process.env.NODE_ENV);
      console.log('[Login] ReturnTo param:', returnTo);
      console.log('[Login] Onboarding token:', onboardingToken ? 'present' : 'not present');
      
      const payload = {
        ...values,
        ...(onboardingToken && { onboardingToken }),
      };
      const response: any = await apiRequest("POST", "/api/auth/login", payload);
      
      console.log('[Login] Login API response received:', {
        userId: response?.id,
        email: response?.email,
        isAdmin: response?.isAdmin
      });
      
      // Refresh user data and wait for it to be refetched
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Wait a bit for session to be fully established and subscription linking to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // PRIORITY: If returnTo is explicitly set to checkout, always go there first
      // This allows users to purchase additional memberships even if they already have one
      console.log('[Login] Checking returnTo before membership check:', returnTo);
      if (returnTo === '/founding-partner-checkout' || returnTo === '%2Ffounding-partner-checkout') {
        console.log('[Login] returnTo is checkout page - redirecting to checkout immediately (before membership check)');
        // Dev environments - stay on current domain
        if (isDevEnvironment()) {
          console.log('[Login] Dev environment, using relative checkout path');
          setTimeout(() => {
            window.location.replace('/founding-partner-checkout');
          }, 50);
        } else if (isProductionApp()) {
          // On app subdomain, redirect to marketing domain for checkout
          console.log('[Login] On app subdomain, redirecting to marketing domain for checkout');
          setTimeout(() => {
            window.location.replace('https://lead2lease.ai/founding-partner-checkout');
          }, 50);
        } else {
          setTimeout(() => {
            window.location.replace("/founding-partner-checkout");
          }, 50);
        }
        return;
      }
      
      // Check membership status for other redirects
      if (response?.isAdmin) {
        // Use window.location.replace to prevent browser password prompts from blocking navigation
        setTimeout(() => {
          window.location.replace("/admin/demo-requests");
        }, 50);
        return;
      } else {
        // Check if user is part of an organization that has an active membership
        // This check works the same for both owners and non-owners since it checks the org's status
        let hasMembership = false;
        let hasAdminRole = false;
        let retries = 0;
        const maxRetries = 5; // Increased retries to allow more time for subscription linking
        
        while (retries < maxRetries && !hasMembership) {
          try {
            // Use the membership status endpoint - it checks the organization's membership status
            // This works the same for owners and non-owners since it's based on the org, not the user's role
            const membershipRes = await fetch("/api/membership/status", {
              credentials: "include",
            });
            
            if (membershipRes.ok) {
              const membershipData = await membershipRes.json();
              console.log(`[Login] ===== MEMBERSHIP STATUS RESPONSE (attempt ${retries + 1}) =====`);
              console.log(`[Login] Full membership data:`, JSON.stringify(membershipData, null, 2));
              console.log(`[Login] membershipData.isFoundingPartner:`, membershipData?.isFoundingPartner);
              console.log(`[Login] membershipData.status:`, membershipData?.status);
              console.log(`[Login] membershipData.orgName:`, membershipData?.orgName);
              console.log(`[Login] membershipData.orgId:`, membershipData?.orgId);
              
              // Check if organization has active membership (works for all users in the org)
              // Primary check: isFoundingPartner flag. Only admin/owner roles can access the app.
              hasMembership = membershipData?.isFoundingPartner === true;
              hasAdminRole = membershipData?.hasAdminRole === true;
              console.log(`[Login] After primary check (isFoundingPartner), hasMembership:`, hasMembership, 'hasAdminRole:', hasAdminRole);
              
              // Fallback 1: Check status field
              if (!hasMembership && membershipData?.status === 'active') {
                console.log('[Login] Status is active but isFoundingPartner is false, treating as active');
                hasMembership = true;
              }
              
              // Fallback 2: If user has an org, check org details directly
              if (!hasMembership && membershipData?.orgName) {
                console.log('[Login] User has organization but membership status shows inactive, checking org details directly...');
                try {
                  // Get current organization to check its status
                  const orgRes = await fetch("/api/organizations/current", {
                    credentials: "include",
                  });
                  if (orgRes.ok) {
                    const orgData = await orgRes.json();
                    console.log('[Login] Current organization data:', orgData);
                    if (orgData?.orgId) {
                      const orgDetailsRes = await fetch(`/api/organizations/${orgData.orgId}`, {
                        credentials: "include",
                      });
                      if (orgDetailsRes.ok) {
                        const orgDetails = await orgDetailsRes.json();
                        console.log('[Login] Organization details:', JSON.stringify(orgDetails, null, 2));
                        const orgStatus = orgDetails?.foundingPartnerStatus;
                        console.log(`[Login] Organization status from details: ${orgStatus}`);
                        
                        // If org status is active, user has membership
                        if (orgStatus === 'active') {
                          console.log('[Login] ✅ Organization has active status - checking admin role');
                          hasMembership = true;
                          // Check admin role from org list (orgData has role for current org)
                          hasAdminRole = orgData?.role === 'admin' || orgData?.role === 'owner';
                          if (!hasAdminRole) {
                            try {
                              const orgsRes = await fetch("/api/organizations", { credentials: "include" });
                              if (orgsRes.ok) {
                                const orgs = await orgsRes.json();
                                hasAdminRole = Array.isArray(orgs) && orgs.some((o: { role?: string }) => o.role === 'admin' || o.role === 'owner');
                              }
                            } catch (_) {}
                          }
                          break;
                        }
                        
                        // Also check if org has a subscription ID (even if status isn't set correctly)
                        if (orgDetails?.stripeSubscriptionId && !hasMembership) {
                          console.log('[Login] Organization has subscription ID, verifying in Stripe...');
                          // The membership status endpoint should have verified this, but if it didn't,
                          // we'll trust that if there's a subscription ID, the org likely has access
                          // (The endpoint will verify it's active)
                        }
                      }
                    }
                  }
                } catch (orgError) {
                  console.error('[Login] Error checking organization details:', orgError);
                }
              }
              
              // Only admins/owners can access the app - hasMembership alone is not enough
              if (hasMembership && !hasAdminRole) {
                console.log('[Login] User has membership but no admin/owner role - cannot access app');
                hasMembership = false; // Treat as no access
              }
              if (hasMembership) {
                console.log('[Login] ✅ User is part of organization with active membership and has admin role');
                break;
              }
            } else if (membershipRes.status === 401) {
              // Not authenticated - shouldn't happen but handle it
              console.error('[Login] Not authenticated when checking membership');
              break;
            } else if (membershipRes.status === 500) {
              // Server error - retry
              console.warn(`[Login] Server error checking membership (attempt ${retries + 1}), will retry`);
            } else {
              const errorData = await membershipRes.json().catch(() => ({}));
              console.error(`[Login] Membership status check failed (status ${membershipRes.status}):`, errorData);
            }
            
            // If no membership found, wait a bit and retry (in case subscription linking is in progress)
            if (!hasMembership && retries < maxRetries - 1) {
              const delay = 500 * (retries + 1); // Exponential backoff
              console.log(`[Login] No active membership found, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (error: any) {
            console.error(`[Login] Error checking membership status (attempt ${retries + 1}):`, error);
            if (retries < maxRetries - 1) {
              const delay = 500 * (retries + 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          retries++;
        }
        
        // Check domain context - using centralized helpers
        const hostname = window.location.hostname.toLowerCase();
        const isDev = isDevEnvironment();
        const isProdApp = isProductionApp();
        const isProdMarketing = isProductionMarketing();
        
        if (hasMembership && hasAdminRole) {
          // User has ACTIVE membership AND admin/owner role - only admins can access the app
          console.log('[Login] ✅ User has membership and admin role - determining redirect path');
          console.log('[Login] Hostname:', hostname);
          console.log('[Login] isDevEnvironment:', isDev);
          console.log('[Login] isProductionApp:', isProdApp);
          console.log('[Login] isProductionMarketing:', isProdMarketing);
          console.log('[Login] hasMembership:', hasMembership);
          
          // Use centralized redirect helper
          const redirectPath = getPostLoginRedirect();
          console.log('[Login] ✅ Using getPostLoginRedirect:', redirectPath);
          
          console.log('[Login] 🔄 Executing redirect to app');
          console.log('[Login] Current window.location.href before redirect:', window.location.href);
          console.log('[Login] Redirect path:', redirectPath);
          console.log('[Login] Final redirect URL will be:', redirectPath.startsWith('http') ? redirectPath : window.location.origin + redirectPath);
          
          // Use window.location.replace to prevent browser password prompts from blocking navigation
          setTimeout(() => {
            window.location.replace(redirectPath);
          }, 50);
          } else if (hasMembership && !hasAdminRole) {
            // Has membership but not admin/owner - redirect to waitlist
            console.log('[Login] User has membership but no admin role - redirecting to waitlist');
            const waitlistPath = isProdApp ? 'https://app.lead2lease.ai/waitlist' : '/waitlist';
            setTimeout(() => {
              window.location.replace(waitlistPath);
            }, 50);
          } else {
            // User doesn't have an organization with ACTIVE membership
            // Check if returnTo is an accept-invitation link
            // If so, check if the organization in that invitation has membership
            if (returnTo && returnTo.includes('/accept-invitation/')) {
              const tokenMatch = returnTo.match(/\/accept-invitation\/([^\/]+)/);
              if (tokenMatch && tokenMatch[1]) {
                const invitationToken = tokenMatch[1];
                console.log('[Login] returnTo is accept-invitation, checking if org has membership for token:', invitationToken);
                
                try {
                  // Verify the invitation to get org info
                  const verifyRes = await fetch(`/api/team/invitations/verify/${invitationToken}`, {
                    credentials: "include",
                  });
                  
                  if (verifyRes.ok) {
                    const invitationData = await verifyRes.json();
                    console.log('[Login] Invitation data:', invitationData);
                    
                    // Check if the organization has membership (from verify response)
                    const orgHasMembership = invitationData?.orgHasMembership === true;
                    
                    if (orgHasMembership) {
                      console.log('[Login] ✅ Organization has membership, auto-accepting invitation and redirecting to app');
                      // Auto-accept the invitation since org has membership, then redirect to app
                      try {
                        const acceptRes = await fetch(`/api/team/invitations/accept/${invitationToken}`, {
                          method: 'POST',
                          credentials: "include",
                        });
                        
                        if (acceptRes.ok) {
                          const acceptData = await acceptRes.json();
                          console.log('[Login] ✅ Invitation accepted automatically');
                          // Refetch user data to update organization switcher
                          await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                          // Redirect to app since org has membership
                          // Use correct path based on current domain
                          const appRedirectPath = isProdApp ? "/" : "/app";
                          console.log('[Login] ✅ Redirecting to:', appRedirectPath);
                          // Use window.location.replace to prevent browser password prompts from blocking navigation
                          setTimeout(() => {
                            window.location.replace(appRedirectPath);
                          }, 50);
                          return;
                        } else {
                          console.warn('[Login] Failed to auto-accept invitation, redirecting to accept-invitation page');
                        }
                      } catch (acceptError) {
                        console.error('[Login] Error auto-accepting invitation:', acceptError);
                        // Fall through to redirect to accept-invitation page
                      }
                    } else {
                      console.log('[Login] Organization does not have membership, will redirect to accept-invitation page');
                    }
                  }
                } catch (invitationError) {
                  console.error('[Login] Error checking invitation org membership:', invitationError);
                  // Fall through to redirect to accept-invitation page
                }
              }
              
              // If we get here, redirect to accept-invitation page (org doesn't have membership or check failed)
              console.log('[Login] Redirecting to accept-invitation page');
              // Use window.location.replace to prevent browser password prompts from blocking navigation
              setTimeout(() => {
                window.location.replace(returnTo);
              }, 50);
            } else if (returnTo) {
              console.log('[Login] No membership, redirecting to returnTo:', returnTo);
              // Dev environments - stay on current domain
              if (isDev) {
                console.log('[Login] Dev environment, using relative returnTo');
                setTimeout(() => {
                  window.location.replace(returnTo);
                }, 50);
              } else if (isProdApp) {
                // On app subdomain, redirect to marketing domain for checkout flow
                const returnToPath = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
                const marketingUrl = `https://lead2lease.ai${returnToPath}`;
                console.log('[Login] Redirecting to marketing domain:', marketingUrl);
                setTimeout(() => {
                  window.location.replace(marketingUrl);
                }, 50);
              } else {
                setTimeout(() => {
                  window.location.replace(returnTo);
                }, 50);
              }
            } else {
              console.log('[Login] ❌ No organization with ACTIVE membership found after all checks');
              console.log('[Login] Redirect destination will be: /waitlist');
              console.log('[Login] Current window.location.href before redirect:', window.location.href);
              console.log('[Login] Current window.location.origin:', window.location.origin);
              
              // Dev environments - stay on current domain
              if (isDev) {
                console.log('[Login] Dev environment, using relative waitlist path');
                setTimeout(() => {
                  window.location.replace('/waitlist');
                }, 50);
              } else if (isProdApp) {
                console.log('[Login] On app subdomain, redirecting to waitlist');
                setTimeout(() => {
                  window.location.replace('https://app.lead2lease.ai/waitlist');
                }, 50);
              } else {
                setTimeout(() => {
                  const redirectPath = "/waitlist";
                  console.log('[Login] 🔄 Executing redirect to:', redirectPath);
                  window.location.replace(redirectPath);
                }, 50);
              }
            }
          }
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOAuthLogin(provider: string) {
    let url = `/api/auth/${provider}`;
    const params = new URLSearchParams();
    params.set("from", "login"); // Indicate this is from login page
    if (onboardingToken) {
      params.set("onboardingToken", onboardingToken);
    }
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    window.location.href = url;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200/50 sticky top-0 bg-gray-50/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a 
              href={getHomeUrl()} 
              className="flex items-center gap-2 hover:opacity-80" 
              data-testid="link-home"
              onClick={(e) => {
                const homeUrl = getHomeUrl();
                if (homeUrl.startsWith('http')) {
                  e.preventDefault();
                  window.location.href = homeUrl;
                }
              }}
            >
              <img 
                src={logo} 
                alt="Logo" 
                className="h-12 w-auto object-contain"
              />
            </a>
            <a 
              href={getHomeUrl()}
              data-testid="link-back-to-home"
              onClick={(e) => {
                const homeUrl = getHomeUrl();
                if (homeUrl.startsWith('http')) {
                  e.preventDefault();
                  window.location.href = homeUrl;
                }
              }}
            >
              <Button variant="secondary" className="gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900">
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Form Section - 2 Column Layout */}
      <div className="container mx-auto px-4 py-6 min-h-[calc(100vh-80px)]">
        <div className="grid xl:grid-cols-2 gap-8 items-start max-w-7xl mx-auto">
          {/* Left Column - Login Form */}
          <div className="w-full max-w-sm mx-auto xl:mx-0">
            {/* Header Section with Gradient */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Welcome Back
              </h1>
              <p className="text-sm text-gray-600">
                Sign in to access your account
              </p>
            </div>

            <Card className="border border-gray-200 shadow-lg bg-white">
            <CardContent className="pt-6 pb-6 space-y-3">
              {/* OAuth Providers */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("google")}
                  data-testid="button-google-login"
                  className="w-full border-gray-300 hover:bg-gray-50 text-xs py-2 h-auto"
                >
                  <SiGoogle className="mr-1.5 h-3.5 w-3.5 text-[#4285F4]" />
                  <span className="text-gray-900">Google</span>
                </Button>
                <Button
                  variant="outline"
                  disabled
                  data-testid="button-facebook-login"
                  className="w-full border-gray-300 hover:bg-gray-50 opacity-60 cursor-not-allowed text-xs py-2 h-auto flex-col gap-0.5"
                  title="Coming soon"
                >
                  <div className="flex items-center">
                    <SiFacebook className="mr-1.5 h-3.5 w-3.5 text-[#1877F2]" />
                    <span className="text-gray-900 text-xs">Facebook</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Coming soon</span>
                </Button>
                <Button
                  variant="outline"
                  disabled
                  data-testid="button-microsoft-login"
                  className="w-full border-gray-300 hover:bg-gray-50 opacity-60 cursor-not-allowed text-xs py-2 h-auto flex-col gap-0.5"
                  title="Coming soon"
                >
                  <div className="flex items-center">
                    <Mail className="mr-1.5 h-3.5 w-3.5 text-[#00A4EF]" />
                    <span className="text-gray-900 text-xs">Microsoft</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Coming soon</span>
                </Button>
                <Button
                  variant="outline"
                  disabled
                  data-testid="button-apple-login"
                  className="w-full border-gray-300 hover:bg-gray-50 opacity-60 cursor-not-allowed text-xs py-2 h-auto flex-col gap-0.5"
                  title="Coming soon"
                >
                  <div className="flex items-center">
                    <SiApple className="mr-1.5 h-3.5 w-3.5 text-gray-900" />
                    <span className="text-gray-900 text-xs">Apple</span>
                  </div>
                  <span className="text-[10px] text-gray-500">Coming soon</span>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Email/Password Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email*</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            {...field}
                            className="bg-gray-50 border-gray-300 text-gray-900"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password*</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="bg-gray-50 border-gray-300 text-gray-900"
                            data-testid="input-password"
                            autoComplete="current-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Form>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link 
                  href={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : "/register"} 
                  className="text-primary hover:underline" 
                  data-testid="link-register"
                >
                  Create account
                </Link>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Right Column - Value Proposition & KPIs */}
          <div className="hidden xl:block space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-2 text-gray-900">
                Why Lead2Lease?
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                Transform your leasing operations with AI-powered automation.
              </p>
              <p className="text-xs text-gray-600 mb-4">
                Lead2Lease automates your entire rental pipeline: from initial <strong>leads</strong> to AI-powered <strong>prequalification</strong>, automated <strong>booking</strong> of showings, streamlined <strong>application</strong> processing, and final <strong>leasing</strong> — all in one platform.
              </p>
            </div>

            {/* Key Metrics - Horizontal Layout */}
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[80px] text-center p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="text-base font-bold text-primary mb-0.5">42%</div>
                <div className="text-xs text-gray-600">Lead to Tour</div>
              </div>
              <div className="flex-1 min-w-[80px] text-center p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="text-base font-bold text-primary mb-0.5">70%</div>
                <div className="text-xs text-gray-600">Time Saved</div>
              </div>
              <div className="flex-1 min-w-[80px] text-center p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="text-base font-bold text-primary mb-0.5">113%</div>
                <div className="text-xs text-gray-600">More Appointments</div>
              </div>
              <div className="flex-1 min-w-[80px] text-center p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="text-base font-bold text-primary mb-0.5">9</div>
                <div className="text-xs text-gray-600">Fewer Days</div>
              </div>
              <div className="flex-1 min-w-[80px] text-center p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="text-base font-bold text-primary mb-0.5">40%</div>
                <div className="text-xs text-gray-600">More Leases</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              KPIs are based on market research
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
