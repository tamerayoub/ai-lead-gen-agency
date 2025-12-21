import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Building2, Mail, User, ArrowLeft, Bot, Calendar, BarChart3, Home } from "lucide-react";
import logo from "@/assets/lead2lease-logo-black.svg";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms of Use to create an account",
  }),
  agreeMarketing: z.boolean().refine((val) => val === true, {
    message: "You must agree to receive marketing communications to create an account",
  }),
});

// Helper function to get home URL - redirects to marketing domain if on app subdomain
function getHomeUrl(): string {
  if (typeof window === 'undefined') return '/';
  
  const hostname = window.location.hostname.toLowerCase();
  const isAppSubdomain = hostname === 'app.lead2lease.ai' || hostname.startsWith('app.');
  
  // In production, if on app subdomain, redirect to marketing domain
  if (isAppSubdomain && (hostname.includes('lead2lease.ai') || hostname.includes('lead2lease'))) {
    return 'https://lead2lease.ai';
  }
  
  return '/';
}

// Helper function to get the correct URL for legal pages (Terms, Privacy, etc.)
// Redirects to marketing domain if on app subdomain
function getLegalPageUrl(path: string, returnTo?: string): string {
  if (typeof window === 'undefined') return path;
  
  const hostname = window.location.hostname.toLowerCase();
  const isAppSubdomain = hostname === 'app.lead2lease.ai' || hostname.startsWith('app.');
  
  // Build the returnTo parameter
  let returnToParam = '';
  if (returnTo) {
    const currentPath = window.location.pathname;
    const fullReturnTo = currentPath + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '');
    returnToParam = `?returnTo=${encodeURIComponent(fullReturnTo)}`;
  } else {
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    if (currentPath || currentSearch) {
      const fullReturnTo = currentPath + currentSearch;
      returnToParam = `?returnTo=${encodeURIComponent(fullReturnTo)}`;
    }
  }
  
  // In production, if on app subdomain, redirect to marketing domain
  if (isAppSubdomain && (hostname.includes('lead2lease.ai') || hostname.includes('lead2lease'))) {
    return `https://lead2lease.ai${path}${returnToParam}`;
  }
  
  return `${path}${returnToParam}`;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [showOAuthConsent, setShowOAuthConsent] = useState(false);
  const [pendingOAuthProvider, setPendingOAuthProvider] = useState<string | null>(null);
  const [oauthAgreeTerms, setOAuthAgreeTerms] = useState(false);
  const [oauthAgreeMarketing, setOAuthAgreeMarketing] = useState(false);

  // Check for onboarding token and returnTo in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("onboardingToken");
    const returnToParam = params.get("returnTo");
    if (token) {
      setOnboardingToken(token);
    }
    if (returnToParam) {
      setReturnTo(returnToParam);
    }
    // Scroll to top when page loads
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Restore form data from sessionStorage on mount
  const savedFormData = typeof window !== 'undefined' ? sessionStorage.getItem('registerFormData') : null;
  const initialValues = savedFormData ? (() => {
    try {
      const parsed = JSON.parse(savedFormData);
      // Always ensure terms and marketing checkboxes are unchecked initially
      return {
        ...parsed,
        agreeTerms: false,
        agreeMarketing: false,
      };
    } catch (error) {
      console.error('Failed to parse saved form data:', error);
      return undefined;
    }
  })() : undefined;

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: initialValues || {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      agreeTerms: false,
      agreeMarketing: false,
    },
  });

  // Save form data to sessionStorage whenever form values change
  useEffect(() => {
    const subscription = form.watch((value) => {
      sessionStorage.setItem('registerFormData', JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      setIsLoading(true);
      // Clear saved form data on successful submission
      sessionStorage.removeItem('registerFormData');
      const payload = {
        ...values,
        ...(onboardingToken && { onboardingToken }),
      };
      const response = await apiRequest("POST", "/api/auth/register", payload);
      
      toast({
        title: "Account created!",
        description: "Welcome! Your account has been created successfully.",
      });
      
      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Check if returnTo is an accept-invitation link and handle it
      if (returnTo && returnTo.includes('/accept-invitation/')) {
        const tokenMatch = returnTo.match(/\/accept-invitation\/([^\/]+)/);
        if (tokenMatch && tokenMatch[1]) {
          const invitationToken = tokenMatch[1];
          console.log('[Register] returnTo is accept-invitation, checking if org has membership for token:', invitationToken);
          
          try {
            // Verify the invitation to get org info
            const verifyRes = await fetch(`/api/team/invitations/verify/${invitationToken}`, {
              credentials: "include",
            });
            
            if (verifyRes.ok) {
              const invitationData = await verifyRes.json();
              console.log('[Register] Invitation data:', invitationData);
              
              // Check if the organization has membership (from verify response)
              const orgHasMembership = invitationData?.orgHasMembership === true;
              
              if (orgHasMembership) {
                console.log('[Register] ✅ Organization has membership, auto-accepting invitation and redirecting to /app');
                // Auto-accept the invitation since org has membership, then redirect to /app
                try {
                  const acceptRes = await fetch(`/api/team/invitations/accept/${invitationToken}`, {
                    method: 'POST',
                    credentials: "include",
                  });
                  
                  if (acceptRes.ok) {
                    const acceptData = await acceptRes.json();
                    console.log('[Register] ✅ Invitation accepted automatically');
                    // Refetch user data to update organization switcher
                    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    // Redirect to /app since org has membership
                    setTimeout(() => {
                      window.location.replace("/app");
                    }, 50);
                    return;
                  } else {
                    console.warn('[Register] Failed to auto-accept invitation, redirecting to accept-invitation page');
                  }
                } catch (acceptError) {
                  console.error('[Register] Error auto-accepting invitation:', acceptError);
                  // Fall through to redirect to accept-invitation page
                }
              } else {
                console.log('[Register] Organization does not have membership, will redirect to accept-invitation page');
              }
            }
          } catch (invitationError) {
            console.error('[Register] Error checking invitation org membership:', invitationError);
            // Fall through to redirect to accept-invitation page
          }
          
          // If we get here, redirect to accept-invitation page (org doesn't have membership or check failed)
          setTimeout(() => {
            window.location.replace(returnTo);
          }, 50);
          return;
        }
      }
      
      // Redirect to returnTo URL if provided, otherwise go to membership checkout
      if (returnTo) {
        // If on app subdomain, redirect to marketing domain for checkout flow
        const hostname = window.location.hostname.toLowerCase();
        const isAppSubdomain = hostname === 'app.lead2lease.ai' || hostname.startsWith('app.');
        
        if (isAppSubdomain && (hostname.includes('lead2lease.ai') || hostname.includes('lead2lease'))) {
          // Convert returnTo path to marketing domain URL
          const returnToPath = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
          const marketingUrl = `https://lead2lease.ai${returnToPath}`;
          console.log('[Register] Redirecting to marketing domain:', marketingUrl);
          setTimeout(() => {
            window.location.replace(marketingUrl);
          }, 50);
        } else {
          setTimeout(() => {
            window.location.replace(returnTo);
          }, 50);
        }
      } else {
        // If on app subdomain, redirect to marketing domain for checkout
        const hostname = window.location.hostname.toLowerCase();
        const isAppSubdomain = hostname === 'app.lead2lease.ai' || hostname.startsWith('app.');
        
        if (isAppSubdomain && (hostname.includes('lead2lease.ai') || hostname.includes('lead2lease'))) {
          setTimeout(() => {
            window.location.replace('https://lead2lease.ai/founding-partner-checkout');
          }, 50);
        } else {
          setTimeout(() => {
            window.location.replace("/founding-partner-checkout");
          }, 50);
        }
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOAuthRegister(provider: string) {
    // Show consent dialog first
    setPendingOAuthProvider(provider);
    setShowOAuthConsent(true);
  }

  function handleOAuthConsentConfirm() {
    if (!oauthAgreeTerms) {
      toast({
        title: "Terms Required",
        description: "You must accept the Terms of Service and Privacy Notice to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!oauthAgreeMarketing) {
      toast({
        title: "Marketing Consent Required",
        description: "You must agree to receive marketing communications to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!pendingOAuthProvider) return;

    // Store consent in session before redirecting
    fetch('/api/auth/store-oauth-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        agreeTerms: oauthAgreeTerms,
        agreeMarketing: oauthAgreeMarketing,
      }),
    }).then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || "Failed to store consent");
        });
      }
      // Redirect to OAuth
      let url = `/api/auth/${pendingOAuthProvider}`;
      const params = new URLSearchParams();
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
    }).catch((error) => {
      console.error('Error storing OAuth consent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    });
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
      <div className="container mx-auto px-4 pt-1 pb-6 min-h-[calc(100vh-80px)]">
        <div className="grid xl:grid-cols-2 gap-8 items-start max-w-7xl mx-auto">
          {/* Left Column - Register Form */}
          <div className="w-full max-w-sm mx-auto xl:mx-0">
            {/* Header Section with Gradient */}
            <div className="text-center mb-1">
              <h1 className="text-xl font-bold mb-0.5 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Create Your Account
              </h1>
              <p className="text-xs text-gray-600">
                Get started with your account
              </p>
            </div>

            <Card className="border border-gray-200 shadow-lg bg-white">
            <CardContent className="pt-3 pb-4 space-y-2">
              {/* OAuth Providers */}
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthRegister("google")}
                  data-testid="button-google-register"
                  className="w-full border-gray-300 hover:bg-gray-50 text-xs py-2 h-auto"
                >
                  <SiGoogle className="mr-1.5 h-3.5 w-3.5 text-[#4285F4]" />
                  <span className="text-gray-900">Google</span>
                </Button>
                <Button
                  variant="outline"
                  disabled
                  data-testid="button-facebook-register"
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
                  data-testid="button-microsoft-register"
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
                  data-testid="button-apple-register"
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

              <div className="relative my-1">
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          {...field}
                          className="bg-gray-50 border-gray-300 text-gray-900"
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          className="bg-gray-50 border-gray-300 text-gray-900"
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Terms and Email Subscription Checkboxes */}
              <FormField
                control={form.control}
                name="agreeTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal text-gray-900">
                        You accept our{" "}
                        <a 
                          href={getLegalPageUrl('/terms-of-service', returnTo || undefined)} 
                          className="text-blue-600 hover:underline"
                          onClick={(e) => {
                            const url = getLegalPageUrl('/terms-of-service', returnTo || undefined);
                            if (url.startsWith('http')) {
                              e.preventDefault();
                              window.location.href = url;
                            }
                          }}
                        >
                          Terms of Service
                        </a>
                        {" "}and{" "}
                        <a 
                          href={getLegalPageUrl('/privacy-notice', returnTo || undefined)} 
                          className="text-blue-600 hover:underline"
                          onClick={(e) => {
                            const url = getLegalPageUrl('/privacy-notice', returnTo || undefined);
                            if (url.startsWith('http')) {
                              e.preventDefault();
                              window.location.href = url;
                            }
                          }}
                        >
                          Privacy Notice
                        </a>
                        .*
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="agreeMarketing"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-marketing"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal text-gray-900">
                        I agree to receive marketing communications from Lead2Lease.*
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </Form>

              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button 
                  onClick={() => {
                    const hostname = window.location.hostname.toLowerCase();
                    const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
                    const loginPath = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
                    
                    if (isProductionMarketing) {
                      window.location.href = `https://app.lead2lease.ai${loginPath}`;
                    } else {
                      window.location.href = loginPath;
                    }
                  }}
                  className="text-primary hover:underline cursor-pointer" 
                  data-testid="link-login"
                >
                  Sign in
                </button>
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

      {/* OAuth Consent Dialog */}
      <Dialog open={showOAuthConsent} onOpenChange={setShowOAuthConsent}>
        <DialogContent className="bg-white text-gray-900 border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Accept Terms to Continue</DialogTitle>
            <DialogDescription className="text-gray-600">
              Please review and accept our terms before creating your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                checked={oauthAgreeTerms}
                onCheckedChange={(checked) => setOAuthAgreeTerms(checked === true)}
                id="oauth-terms"
              />
              <label
                htmlFor="oauth-terms"
                className="text-sm leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                You accept our{" "}
                <a 
                  href={getLegalPageUrl('/terms-of-service', returnTo || undefined)} 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  onClick={(e) => {
                    const url = getLegalPageUrl('/terms-of-service', returnTo || undefined);
                    if (url.startsWith('http')) {
                      e.preventDefault();
                      window.open(url, '_blank');
                    }
                  }}
                >
                  Terms of Service
                </a>
                {" "}and{" "}
                <a 
                  href={getLegalPageUrl('/privacy-notice', returnTo || undefined)} 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  onClick={(e) => {
                    const url = getLegalPageUrl('/privacy-notice', returnTo || undefined);
                    if (url.startsWith('http')) {
                      e.preventDefault();
                      window.open(url, '_blank');
                    }
                  }}
                >
                  Privacy Notice
                </a>
                .*
              </label>
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                checked={oauthAgreeMarketing}
                onCheckedChange={(checked) => setOAuthAgreeMarketing(checked === true)}
                id="oauth-marketing"
              />
              <label
                htmlFor="oauth-marketing"
                className="text-sm leading-none text-gray-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to receive marketing communications from Lead2Lease.*
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOAuthConsent(false);
                setPendingOAuthProvider(null);
                setOAuthAgreeTerms(false);
                setOAuthAgreeMarketing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOAuthConsentConfirm}
              disabled={!oauthAgreeTerms || !oauthAgreeMarketing}
            >
              Continue with {pendingOAuthProvider === 'google' ? 'Google' : pendingOAuthProvider === 'facebook' ? 'Facebook' : pendingOAuthProvider === 'microsoft' ? 'Microsoft' : pendingOAuthProvider === 'apple' ? 'Apple' : 'OAuth'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
