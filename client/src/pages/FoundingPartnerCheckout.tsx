import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Crown,
  Rocket,
  Star,
  Users,
  Lock,
  Headphones,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Shield,
  Bot,
  Calendar,
  MessageSquare,
  BarChart3,
  Building2,
  Zap,
  Home,
  Clock,
  Mail,
  LogIn,
  AlertTriangle,
  Plus,
  FileText,
  FileCheck,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const PURCHASE_INTENT_KEY = "founding_partner_purchase_intent";

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

function CheckoutContent() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [showNewOrgInput, setShowNewOrgInput] = useState(false);
  
  // Fetch founding partner price from Stripe
  const { data: priceData, isLoading: priceLoading } = useQuery<{
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

  // Check if user has an org (only for authenticated users)
  const { data: currentOrg, isLoading: orgLoading } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: isAuthenticated,
  });

  // Fetch all user organizations to check if they have multiple
  const { data: userOrgs, isLoading: userOrgsLoading } = useQuery<Array<{ orgId: string; orgName: string; role: string; profileImage?: string | null; deletedAt?: string | null }>>({
    queryKey: ["/api/organizations"],
    enabled: isAuthenticated,
  });

  // Check user's Stripe subscriptions to see which orgs have memberships
  const { data: subscriptionInfo, isLoading: subscriptionsLoading } = useQuery<{
    hasSubscriptions: boolean;
    subscriptions: Array<{ id: string; status: string; customerId: string; currentPeriodEnd: string | null; orgId: string | null; orgName: string | null; cancelAtPeriodEnd?: boolean }>;
  }>({
    queryKey: ["/api/stripe/user-subscriptions"],
    enabled: isAuthenticated,
  });

  // Filter to only show organizations where user is owner
  const ownerOrgs = userOrgs?.filter(org => org.role === 'owner') || [];
  
  // Filter out organizations that:
  // 1. Are deactivated/pending deletion (have deletedAt set)
  // 2. Already have an active membership
  // 3. Have a subscription that's set to cancel at period end
  const ownerOrgsWithoutMembership = ownerOrgs.filter(org => {
    // Exclude deactivated/pending deletion organizations
    if (org.deletedAt) {
      return false;
    }
    
    // Check if this org has an active subscription
    const orgSubscription = subscriptionInfo?.subscriptions?.find(sub => sub.orgId === org.orgId);
    
    // Exclude if subscription is set to cancel at period end
    if (orgSubscription?.cancelAtPeriodEnd) {
      return false;
    }
    
    // Exclude if org has an active membership
    const hasActiveMembership = orgSubscription && (orgSubscription.status === 'active' || orgSubscription.status === 'trialing');
    return !hasActiveMembership;
  });

  // Check if user already has an active subscription and onboarding status
  const { data: membershipStatus, isLoading: membershipLoading } = useQuery<{
    isFoundingPartner: boolean;
    status: string;
    hasCompletedOnboarding?: boolean;
  }>({
    queryKey: ["/api/membership/status"],
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });

  // Check if user has properties (alternative indicator of onboarding completion)
  const { data: properties } = useQuery<Array<{ id: string }>>({
    queryKey: ["/api/properties"],
    enabled: isAuthenticated,
    staleTime: 0, // Always fetch fresh
  });

  const hasProperties = (properties?.length ?? 0) > 0;
  const actuallyCompletedOnboarding = membershipStatus?.hasCompletedOnboarding || hasProperties;

  // Pre-fill email and name if user is logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (!email && user.email) setEmail(user.email);
      if (!name && (user.firstName || user.lastName)) {
        setName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
      }
    }
  }, [isAuthenticated, user]);

  // Check for purchase intent after login (resume checkout flow)
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const storedIntent = localStorage.getItem(PURCHASE_INTENT_KEY);
      if (storedIntent) {
        try {
          const intent = JSON.parse(storedIntent);
          // Clear the stored intent
          localStorage.removeItem(PURCHASE_INTENT_KEY);
          // Pre-fill form with stored values
          if (intent.name) setName(intent.name);
          if (intent.email) setEmail(intent.email);
          // Auto-proceed to checkout after a brief moment
          setTimeout(() => {
            handleCheckout(intent.name || '', intent.email || '');
          }, 500);
        } catch (e) {
          localStorage.removeItem(PURCHASE_INTENT_KEY);
        }
      }
    }
  }, [isAuthenticated, authLoading]);

  const handleCheckout = async (purchaseName?: string, purchaseEmail?: string, forceNewOrg: boolean = false, providedOrgId?: string | null, newOrganizationName?: string) => {
    try {
      console.log('[Checkout] handleCheckout called with:', { purchaseName, purchaseEmail, forceNewOrg, providedOrgId, newOrganizationName });
      console.log('[Checkout] Current state:', { 
        isAuthenticated, 
        orgLoading, 
        membershipLoading, 
        userOrgsLoading, 
        subscriptionsLoading,
        ownerOrgsWithoutMembership: ownerOrgsWithoutMembership.length,
        email,
        name
      });

    const checkoutName = purchaseName || name;
    const checkoutEmail = purchaseEmail || (user?.email || email);

      console.log('[Checkout] Using checkoutName:', checkoutName, 'checkoutEmail:', checkoutEmail);

      // Validate email
      if (!checkoutEmail || !checkoutEmail.includes('@')) {
        console.log('[Checkout] Email validation failed - email:', checkoutEmail);
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('[Checkout] Email validation passed:', checkoutEmail);

    // If not authenticated, store intent and trigger login
    if (!isAuthenticated) {
        console.log('[Checkout] User not authenticated, redirecting to login');
      // Store purchase intent to resume after login
      localStorage.setItem(PURCHASE_INTENT_KEY, JSON.stringify({
        name: checkoutName,
        email: checkoutEmail,
        timestamp: Date.now(),
      }));
      // Redirect to login page with return URL
      // After login, user will be redirected back to this page
      setLocation(`/login?returnTo=${encodeURIComponent('/founding-partner-checkout')}`);
      return;
    }

      // Wait for queries to finish if they're still loading (only if authenticated)
      if (isAuthenticated && (orgLoading || membershipLoading || userOrgsLoading || subscriptionsLoading)) {
        console.log('[Checkout] Queries still loading, waiting...');
        toast({
          title: "Loading...",
          description: "Please wait while we load your information.",
        });
        return;
      }

    // Determine final orgId and forceNewOrg based on owner status
    let finalOrgId = providedOrgId;
    let finalForceNewOrg = forceNewOrg;
    
      console.log('[Checkout] Organization logic check:', { 
        finalOrgId, 
        finalForceNewOrg, 
        ownerOrgsWithoutMembership: ownerOrgsWithoutMembership.length,
        ownerOrgs: ownerOrgs.length
      });
      
      // Only check organization logic if user is authenticated
      // REQUIREMENT: For authenticated users, MUST select organization before payment
      if (isAuthenticated) {
        // Case 1: User has org(s) without membership - MUST select one or create new
    if (!finalForceNewOrg && !finalOrgId && ownerOrgsWithoutMembership.length > 0) {
          console.log('[Checkout] Showing org selector - user has owner orgs without membership');
      // User has owner org(s) without membership - show selector
      setShowOrgSelector(true);
      return; // Don't proceed with checkout yet
    }
    
        // Case 2: User has no owner orgs without membership
    if (!finalForceNewOrg && !finalOrgId && ownerOrgsWithoutMembership.length === 0) {
          // If user has no orgs at all, show dialog to create new org
          if (!userOrgs || userOrgs.length === 0) {
            console.log('[Checkout] Showing new org input - user has no orgs at all');
      setShowNewOrgInput(true);
      return; // Don't proceed with checkout yet - wait for user to enter org name
          } else {
            // User has orgs but none without membership (all have memberships)
            // Show option to create new org or select existing (but we need to show a dialog)
            console.log('[Checkout] User has orgs but all have memberships - showing new org input');
            setShowNewOrgInput(true);
            return; // Don't proceed with checkout yet - wait for user to create new org
          }
        }
        
        // Case 3: If we reach here, user has selected an org or is creating a new one
        // Validate that we have either an orgId or are creating a new org
        if (!finalForceNewOrg && !finalOrgId && !newOrganizationName) {
          console.error('[Checkout] Invalid state: authenticated user but no org selected or created');
          toast({
            title: "Organization required",
            description: "Please select an organization or create a new one to continue.",
            variant: "destructive",
          });
          return;
        }
      }

      console.log('[Checkout] Proceeding with checkout:', { finalOrgId, finalForceNewOrg, newOrganizationName });

    setIsLoading(true);
    setCheckoutError(null);

    try {
      // Determine which orgId to use:
      // 1. If finalForceNewOrg is true, use null (create new org)
      // 2. If finalOrgId is set (from selector or auto-selection), use that
      // 3. Otherwise, use current org if available
      const orgIdToUse = finalForceNewOrg 
        ? null 
        : (finalOrgId || selectedOrgId || currentOrg?.orgId || null);
      
        console.log('[Checkout] Making API request with:', { 
          email: user?.email || checkoutEmail,
          name: checkoutName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          orgId: orgIdToUse,
          organizationName: newOrganizationName || undefined
        });
        
      // For authenticated users, we may or may not have an org
      // The backend will handle both cases - with org (direct link) or without (pending subscription)
      const response = await fetch("/api/stripe/founding-partner-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: user?.email || checkoutEmail,
          name: checkoutName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          orgId: orgIdToUse, // null for new org when user already has membership
          organizationName: newOrganizationName || undefined, // Organization name if creating new org
        }),
      });

        console.log('[Checkout] API response status:', response.status);
      const data = await response.json();
        console.log('[Checkout] API response data:', data);

      if (!response.ok) {
        // Handle specific error cases
        if (data.error?.includes('already have an active') || data.error?.includes('already has an active')) {
          // If user already has a membership, refetch membership status to show the prompt
          if (isAuthenticated) {
            queryClient.invalidateQueries({ queryKey: ["/api/membership/status"] });
          }
          
          // Show error message - user can select a different organization or create a new one
          toast({
            title: "Organization already has membership",
            description: data.error || "This organization already has an active membership. Please select a different organization or create a new one.",
            variant: "destructive",
          });
          
          setIsLoading(false);
          return;
        }
        throw new Error(data.error || "Checkout failed");
      }

      if (data.url) {
          console.log('[Checkout] Redirecting to checkout URL:', data.url);
        window.location.href = data.url;
      } else {
          console.error('[Checkout] No checkout URL returned in response');
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
        console.error("[Checkout] Checkout error:", error);
        setCheckoutError(error.message || "Something went wrong. Please try again.");
      toast({
        title: "Checkout failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      }
    } catch (error: any) {
      // Catch any errors from early validation or organization selection
      console.error("Checkout setup error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const founderBenefits = [
    { icon: Rocket, title: "Early Access to New Features", description: "Be the first to try cutting-edge AI capabilities" },
    { icon: Star, title: "Priority Feature Requests", description: "Your suggestions go straight to the top of our roadmap" },
    { icon: Users, title: "Direct Founder Access", description: "Personal communication channel with our team" },
    { icon: Lock, title: "Lifetime Discount", description: "Get lifetime discount as a founding partner" },
    { icon: Headphones, title: "White-Glove Onboarding", description: "Personalized setup and training included" },
  ];

  const platformFeatures = [
    { icon: Bot, title: "AI Leasing Agent", description: "24/7 intelligent lead qualification and response. Your AI handles inquiries, answers questions, and pre-qualifies prospects automatically." },
    { icon: Users, title: "CRM", description: "Complete customer relationship management system to track leads, prospects, and resident interactions throughout the entire leasing lifecycle. Centralize all customer data, communication history, and pipeline stages in one powerful platform." },
    { icon: Calendar, title: "Smart Showing Scheduler", description: "Intelligent booking system with conflict detection, buffer times, and automatic availability sync across your calendar." },
    { icon: MessageSquare, title: "Multi-Channel Communication", description: "Unified inbox for Gmail, Outlook, SMS (Twilio), and Facebook Messenger. Never miss a lead again." },
    { icon: BarChart3, title: "Advanced Analytics Dashboard", description: "Track conversion rates, response times, lead sources, and AI performance metrics in real-time." },
    { icon: Building2, title: "Property & Unit Management", description: "Complete portfolio management with individual unit scheduling, custom availability, and listing sync." },
    { icon: Zap, title: "Automated Lead Qualification", description: "Customizable pre-screening questions with scoring. Filter serious prospects before they book showings." },
    { icon: Clock, title: "Showing Reminders", description: "Automatic email reminders to leads before scheduled showings. Reduce no-shows by up to 80%." },
    { icon: Mail, title: "Calendar Integrations", description: "Two-way sync with Google Calendar, Outlook, and other popular calendar platforms. Showings appear automatically with all details." },
    { icon: FileText, title: "AI Leasing", description: "Automated lease generation, review, and management with AI-powered document processing and compliance checks." },
    { icon: CheckCircle2, title: "AI Powered Application Processing", description: "Streamline rental applications with intelligent document review, background check integration, and automated decision support." },
    { icon: Zap, title: "Many Integrations Coming Soon", description: "Coming soon - connect with popular ILS platforms, PMS systems, payment processors, and communication tools for seamless workflow integration." },
  ];

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: '#FFDF00' }} />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user already has active membership
  const isAlreadyMember = membershipStatus?.isFoundingPartner === true;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200/50 sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <a 
            href={getHomeUrl()} 
            onClick={(e) => {
              if (getHomeUrl().startsWith('http')) {
                e.preventDefault();
                window.location.href = getHomeUrl();
              }
            }}
          >
            <img src={logoBlack} alt="Lead2Lease" className="h-10 w-auto cursor-pointer" />
          </a>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              data-testid="button-back-home"
              onClick={async () => {
                const homeUrl = getHomeUrl();
                // If redirecting to marketing domain, use window.location
                if (homeUrl.startsWith('http')) {
                  window.location.href = homeUrl;
                } else {
                  // Sign out and redirect to landing page
                  try {
                    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                    setLocation(homeUrl);
                  } catch (error) {
                    console.error("Logout error:", error);
                    setLocation(homeUrl);
                  }
                }
              }}
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-2 w-full max-w-full">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-1" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
              <Crown className="h-3 w-3" />
              <span className="text-xs font-semibold">Limited Founding Partner Spots</span>
            </div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 bg-clip-text text-transparent">Become a Founding Partner</h1>
            <p className="text-xs md:text-base text-gray-600 max-w-2xl mx-auto">
              Get full access to Lead2Lease's complete AI-powered property leasing platform with exclusive founding partner pricing.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 w-full">
            {/* Left column - Features (moved second on mobile) */}
            <div className="lg:col-span-2 order-2 lg:order-1 space-y-3 w-full min-w-0">
              {/* Platform Features */}
              <Card className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 1))' }}>
                {/* Gold gradient blend from edges */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  background: 'radial-gradient(ellipse at top left, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at top right, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(255, 223, 0, 0.1) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255, 223, 0, 0.1) 0%, transparent 50%)'
                }}></div>
                <CardHeader className="pb-2 px-3 md:px-4 pt-3 md:pt-4 relative z-10" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.08), rgba(255, 223, 0, 0.03))' }}>
                  <div className="mb-2">
                    <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                      <Zap className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" style={{ color: '#FFDF00' }} />
                      <span className="whitespace-nowrap">Everything You Get with Lead2Lease</span>
                    </CardTitle>
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-600 mt-1">Complete AI-powered leasing platform with all features included</p>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-2 md:px-4 relative z-10 overflow-x-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                    {platformFeatures.map((feature, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0"
                      >
                        <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <feature.icon className="h-3 w-3" style={{ color: '#CCB300' }} />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-semibold text-xs text-gray-900 break-words">
                            {feature.title}
                          </div>
                          <p className="text-[10px] leading-tight text-gray-600 break-words">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-3 italic text-center">Note: All features mentioned might not be available right away.</p>
                  
                  {/* ROI KPIs Section */}
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="font-semibold text-xs text-gray-900 mb-2 text-center bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">Customers have seen a increase in the following when using AI-Powered Leasing Automation Software</h4>
                    {/* Desktop view - grid layout */}
                    <div className="hidden md:grid grid-cols-5 gap-1.5 w-full overflow-x-hidden">
                      <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <TrendingUp className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>42%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Lead to Tour</div>
                      </div>
                      <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>70%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Time Saved</div>
                      </div>
                      <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <Calendar className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>113%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">More Appointments</div>
                      </div>
                      <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <TrendingDown className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>9</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Fewer Days</div>
                      </div>
                      <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <FileCheck className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>40%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">More Leases</div>
                      </div>
                    </div>
                    {/* Mobile view - marquee animation */}
                    <div className="md:hidden relative overflow-hidden py-2">
                      {/* Gradient overlays for fade effect */}
                      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                      
                      <div className="flex animate-marquee gap-2" style={{ width: 'max-content', willChange: 'transform' }}>
                        {/* First set of ROI KPIs */}
                        {[
                          { value: "42%", label: "Lead to Tour", icon: TrendingUp },
                          { value: "70%", label: "Time Saved", icon: Clock },
                          { value: "113%", label: "More Appointments", icon: Calendar },
                          { value: "9", label: "Fewer Days", icon: TrendingDown },
                          { value: "40%", label: "More Leases", icon: FileCheck },
                        ].map((kpi, idx) => {
                          const IconComponent = kpi.icon;
                          return (
                            <div key={`roi-1-${idx}`} className="flex-shrink-0">
                              <div className="text-center p-1.5 rounded-lg border w-[100px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                                <IconComponent className="h-[18px] w-[18px] mx-auto mb-1" style={{ color: '#CCB300' }} />
                                <div className="text-lg font-bold mb-0.5" style={{ color: '#CCB300' }}>{kpi.value}</div>
                                <div className="text-[12px] text-gray-600">{kpi.label}</div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Duplicate set for seamless loop */}
                        {[
                          { value: "42%", label: "Lead to Tour", icon: TrendingUp },
                          { value: "70%", label: "Time Saved", icon: Clock },
                          { value: "113%", label: "More Appointments", icon: Calendar },
                          { value: "9", label: "Fewer Days", icon: TrendingDown },
                          { value: "40%", label: "More Leases", icon: FileCheck },
                        ].map((kpi, idx) => {
                          const IconComponent = kpi.icon;
                          return (
                            <div key={`roi-2-${idx}`} className="flex-shrink-0">
                              <div className="text-center p-1.5 rounded-lg border w-[100px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                                <IconComponent className="h-[18px] w-[18px] mx-auto mb-1" style={{ color: '#CCB300' }} />
                                <div className="text-lg font-bold mb-0.5" style={{ color: '#CCB300' }}>{kpi.value}</div>
                                <div className="text-[12px] text-gray-600">{kpi.label}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                      KPIs are based on market research
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Founder Benefits */}
              <Card className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.08), rgba(255, 255, 255, 0.98))' }}>
                {/* Gold gradient overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  background: 'radial-gradient(ellipse at top, rgba(255, 223, 0, 0.12) 0%, transparent 60%)'
                }}></div>
                <CardHeader className="pb-3 px-3 md:px-4 pt-4 md:pt-5 relative z-10" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.15), rgba(255, 223, 0, 0.08))' }}>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                    <Crown className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                    Exclusive Founding Partner Benefits
                  </CardTitle>
                  <p className="text-xs md:text-sm text-gray-600 mt-2">Premium perks reserved for our founding partners</p>
                </CardHeader>
                <CardContent className="p-4 md:p-5 pt-0 relative z-10">
                  <div className="space-y-4 md:space-y-5">
                    {founderBenefits.map((benefit, index) => (
                      <div key={index} className={`flex items-start gap-2 md:gap-3 ${index === 0 ? 'pt-2 md:pt-3' : ''}`}>
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                          <benefit.icon className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm md:text-base text-gray-900 mb-1">{benefit.title}</div>
                          <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Enterprise Customization Value Proposition */}
              <Card className="border-2 shadow-xl relative overflow-visible" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), rgba(255, 255, 255, 0.98))' }}>
                {/* Gold gradient overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  background: 'radial-gradient(ellipse at center, rgba(255, 223, 0, 0.1) 0%, transparent 70%)'
                }}></div>
                <CardContent className="p-4 md:p-6 relative z-10">
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-base md:text-xl mb-2 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                      Get Enterprise-Level Customization Without the Enterprise Price Tag
                    </h3>
                    <p className="text-sm md:text-base text-gray-700 font-medium">
                      Building a custom AI leasing solution costs hundreds of thousands. Lead2Lease delivers that same tailored experience for just <span className="font-bold text-primary">${displayPrice}/mo</span>.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-6">
                    {/* Traditional Custom Development */}
                    <div className="space-y-3 p-4 rounded-lg border-2 bg-white" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.02), rgba(255, 255, 255, 1))' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-red-600 font-bold text-sm">✗</span>
                        </div>
                        <div className="font-bold text-base md:text-lg text-gray-900">Traditional Custom</div>
                      </div>
                      <div className="space-y-2 text-sm md:text-base">
                        <div className="flex items-start gap-2 p-2 rounded bg-red-50/50">
                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                          <span className="flex-1 text-gray-700 font-medium">$100,000+ upfront</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-red-50/50">
                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                          <span className="flex-1 text-gray-700 font-medium">6-12 months dev</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-red-50/50">
                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                          <span className="flex-1 text-gray-700 font-medium">Ongoing maintenance</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-red-50/50">
                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                          <span className="flex-1 text-gray-700 font-medium">Tech team needed</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-red-50/50">
                          <span className="text-red-500 mt-0.5 font-bold">•</span>
                          <span className="flex-1 text-gray-700 font-medium">Project risk</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lead2Lease Founding Member */}
                    <div className="space-y-3 p-4 rounded-lg border-2 relative overflow-visible" style={{ borderColor: 'rgba(255, 223, 0, 0.5)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.1), rgba(255, 223, 0, 0.05))' }}>
                      <div className="absolute top-2 right-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wide text-white shadow-lg" style={{ backgroundColor: '#CCB300' }}>
                          <Crown className="h-3 w-3" />
                          Best Value
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 223, 0, 0.3)' }}>
                          <CheckCircle2 className="h-5 w-5" style={{ color: '#CCB300' }} />
                        </div>
                        <div className="font-bold text-base md:text-lg" style={{ color: '#CCB300' }}>Lead2Lease</div>
                      </div>
                      <div className="space-y-2 text-sm md:text-base">
                        <div className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold">${displayPrice}/mo</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold">Deploy in days</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold">Zero maintenance</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold">No tech expertise</span>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold">Proven platform</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 rounded-lg text-center" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', border: '1px solid rgba(255, 223, 0, 0.3)' }}>
                    <p className="text-sm md:text-base text-gray-800 font-semibold">
                      Why pay hundreds of thousands when you can get a solution that feels custom-built for your business at a fraction of the cost?
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column - Checkout (moved first on mobile) */}
            <div className="order-1 lg:order-2 w-full min-w-0 lg:self-start">
              <Card className="shadow-xl sticky top-20 md:top-24 lg:top-24 z-10 w-full max-w-full lg:max-h-[calc(100vh-6rem)]" data-testid="card-checkout-form" style={{ alignSelf: 'flex-start' }}>
                <CardHeader className="text-white rounded-t-lg py-4 relative" style={{ background: 'linear-gradient(to right, #FFDF00, #E6C900)' }}>
                  <div className="absolute top-2 right-2 md:top-3 md:right-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wide text-white shadow-md" style={{ backgroundColor: '#CCB300' }}>
                      <span className="animate-pulse">⚡</span>
                      Limited Offer
                    </span>
                  </div>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>Founding Partner</span>
                  </CardTitle>
                  <div className="mt-1">
                    {priceLoading ? (
                      <span className="text-3xl font-bold">Loading...</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${displayPrice}</span>
                        <span className="ml-1 opacity-90 text-sm">upfront payment</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs mt-1 opacity-90">Monthly recurring begins post-launch</p>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Show checkout form for everyone (authenticated or not) */}
                  {/* Even if they already have a membership, they can add membership to another organization */}
                  <>
                    {checkoutError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{checkoutError}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          type="text"
                          placeholder="John Smith"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          data-testid="input-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={isAuthenticated ? (user?.email || email) : email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isAuthenticated}
                          className={isAuthenticated ? "bg-gray-50" : ""}
                          data-testid="input-email"
                        />
                        {isAuthenticated && (
                          <p className="text-xs text-gray-500">
                            Using your account email for subscription
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="lg"
                      className="w-full text-base py-5 text-white hover:opacity-90"
                      style={{ backgroundColor: '#FFDF00' }}
                      onClick={() => {
                        console.log('[Checkout] Button clicked!', {
                          isLoading,
                          isAuthenticated,
                          orgLoading,
                          membershipLoading,
                          userOrgsLoading,
                          subscriptionsLoading,
                          email,
                          name,
                          disabled: isLoading || (isAuthenticated && (orgLoading || membershipLoading || userOrgsLoading || subscriptionsLoading))
                        });
                        if (!isLoading && !(isAuthenticated && (orgLoading || membershipLoading || userOrgsLoading || subscriptionsLoading))) {
                          handleCheckout();
                        } else {
                          console.log('[Checkout] Button click ignored - button is disabled');
                        }
                      }}
                      disabled={isLoading || (isAuthenticated && (orgLoading || membershipLoading || userOrgsLoading || subscriptionsLoading))}
                      data-testid="button-complete-purchase"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-4 w-4" />
                          Start Membership
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Shield className="h-3 w-3" />
                      <span>Secure payment via Stripe</span>
                    </div>

                    <div className="text-center text-xs text-gray-400">
                      <p>Cancel anytime • 256-bit SSL encryption</p>
                    </div>
                  </>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Organization Name Input Dialog (for users without orgs) */}
      <Dialog open={showNewOrgInput} onOpenChange={(open) => {
        if (!open) {
          setShowNewOrgInput(false);
          setNewOrgName("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Your Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              To start a membership, you need to create an organization. Enter a name for your organization below.
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-org-name-dialog" className="text-sm font-medium">
                Organization Name *
              </Label>
              <Input
                id="new-org-name-dialog"
                placeholder="Enter organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newOrgName.trim()) {
                    handleCheckout(undefined, undefined, true, null, newOrgName.trim());
                    setNewOrgName("");
                    setShowNewOrgInput(false);
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                This will create a new organization and apply the membership to it. You will become the owner of this organization.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewOrgInput(false);
                  setNewOrgName("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newOrgName.trim()) {
                    handleCheckout(undefined, undefined, true, null, newOrgName.trim());
                    setNewOrgName("");
                    setShowNewOrgInput(false);
                  }
                }}
                disabled={!newOrgName.trim()}
                className="flex-1 text-white hover:opacity-90"
                style={{ backgroundColor: '#FFDF00' }}
              >
                Create & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Organization Selector Dialog */}
      <Dialog open={showOrgSelector} onOpenChange={setShowOrgSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              {ownerOrgsWithoutMembership.length === 1 
                ? "You are the owner of an organization. Which organization would you like to apply this membership to?"
                : ownerOrgsWithoutMembership.length > 1
                ? "You are the owner of multiple organizations. Which organization would you like to apply this membership to?"
                : "You don't have any organizations without a membership. Create a new organization to apply this membership."}
            </p>
            {ownerOrgsWithoutMembership.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ownerOrgsWithoutMembership.map((org) => (
                  <button
                    key={org.orgId}
                    onClick={() => {
                      setSelectedOrgId(org.orgId);
                      setShowOrgSelector(false);
                      handleCheckout(undefined, undefined, false, org.orgId);
                    }}
                    className="w-full text-left p-3 rounded-lg border-2 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{org.orgName}</p>
                        <p className="text-xs text-gray-500 capitalize">Role: {org.role}</p>
                      </div>
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {!showNewOrgInput ? (
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewOrgInput(true);
                }}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Organization
              </Button>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <Label htmlFor="new-org-name" className="text-sm font-medium">
                    Organization Name *
                  </Label>
                  <Input
                    id="new-org-name"
                    placeholder="Enter organization name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="bg-white"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500">
                    Enter a name for your new organization. The membership will be applied to this organization.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewOrgInput(false);
                      setNewOrgName("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (newOrgName.trim()) {
                        setShowOrgSelector(false);
                        setSelectedOrgId(null);
                        // Create new organization with the provided name
                        // We'll need to create the org first, then proceed with checkout
                        handleCheckout(undefined, undefined, true, null, newOrgName.trim());
                        setNewOrgName("");
                        setShowNewOrgInput(false);
                      }
                    }}
                    disabled={!newOrgName.trim()}
                    className="flex-1 text-white hover:opacity-90"
                    style={{ backgroundColor: '#FFDF00' }}
                  >
                    Create & Continue
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageSubscriptionDialog({ onStartNewOrg }: { onStartNewOrg?: () => void }) {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Get user's organizations and roles
  const { data: userOrgs, isLoading: orgsLoading } = useQuery<Array<{ orgId: string; orgName: string; role: string; profileImage?: string | null }>>({
    queryKey: ["/api/organizations"],
    enabled: isAuthenticated,
  });

  // Check if user has any Stripe subscriptions (even if not linked to org)
  const { data: subscriptionInfo, isLoading: subscriptionsLoading } = useQuery<{
    hasSubscriptions: boolean;
    subscriptions: Array<{ id: string; status: string; customerId: string; currentPeriodEnd: string | null; orgId: string | null; orgName: string | null }>;
  }>({
    queryKey: ["/api/stripe/user-subscriptions"],
    enabled: isAuthenticated,
  });

  const ownerOrgs = userOrgs?.filter(org => org.role === 'owner') || [];
  const isOwner = ownerOrgs.length > 0;
  const hasAnyOrg = (userOrgs?.length ?? 0) > 0;
  const hasSubscriptions = subscriptionInfo?.hasSubscriptions || false;
  
  // Check if user is owner of any organization that has an active membership
  // This is determined by checking if any owner organization has a subscription in subscriptionInfo
  const ownerOrgsWithMembership = ownerOrgs.filter(org => {
    // Check if this org has a subscription in the subscriptionInfo
    return subscriptionInfo?.subscriptions?.some(sub => 
      sub.orgId === org.orgId && (sub.status === 'active' || sub.status === 'trialing')
    ) || false;
  });
  const isOwnerWithActiveMembership = ownerOrgsWithMembership.length > 0;

  const handleManageSubscription = async (orgId?: string, customerId?: string) => {
    if (!isAuthenticated || !user?.email) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to manage your subscription.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user.email,
          orgId: orgId, // Optional: specify which org's subscription to manage
          customerId: customerId, // Optional: specify customer ID directly
          // returnUrl is not needed - backend always returns to /app
        }),
      });
      const data = await res.json();
      
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Subscription not found",
          description: data.error || "No active subscription found for this account.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to access customer portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewOrganization = async () => {
    // If onStartNewOrg callback is provided, use it to trigger checkout for new org
    if (onStartNewOrg) {
      onStartNewOrg();
    } else {
      // Fallback: redirect to checkout page
      setLocation('/founding-partner-checkout');
    }
  };

  if (!isAuthenticated) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full text-gray-500" data-testid="button-already-member">
          Already a member? Manage subscription
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Your Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <p className="text-sm text-gray-600">
              Please sign in to manage your subscription.
            </p>
          <Button
            className="w-full"
              onClick={() => setLocation('/login?returnTo=' + encodeURIComponent('/founding-partner-checkout'))}
              data-testid="button-sign-in"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (authLoading || orgsLoading || subscriptionsLoading) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-gray-500" data-testid="button-already-member">
            Already a member? Manage subscription
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Your Subscription</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // REQUIREMENT: Only show if user is owner of an organization with active membership
  if (isOwnerWithActiveMembership) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-gray-500" data-testid="button-already-member">
            Already a member? Manage subscription
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Your Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {isOwnerWithActiveMembership && ownerOrgsWithMembership.length > 0 && (
              <>
                <p className="text-sm text-gray-600">
                  You are the owner of {ownerOrgsWithMembership.length} organization{ownerOrgsWithMembership.length > 1 ? 's' : ''} with active membership{ownerOrgsWithMembership.length > 1 ? 's' : ''}. 
                  Select which subscription you'd like to manage, or start a new organization.
                </p>
                
                <div className="space-y-2">
                  <Label>Your Organizations with Active Membership</Label>
                  {ownerOrgsWithMembership.map((org) => (
                    <Button
                      key={org.orgId}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleManageSubscription(org.orgId)}
                      disabled={isLoading}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <span className="flex-1 text-left">
                        <span className="font-semibold">{org.orgName}</span>
                        <span className="text-xs text-gray-500 ml-2">- Founding Partner Subscription</span>
                      </span>
                      <span className="ml-auto text-xs text-gray-500">Manage</span>
                    </Button>
                  ))}
                </div>
              </>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-3">
                Want to start a new organization? This will create a new subscription.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleStartNewOrganization}
                data-testid="button-start-new-org"
              >
                <Plus className="mr-2 h-4 w-4" />
                Start New Organization
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // REQUIREMENT: Only show "Already a member? Manage subscription" if user is owner with active membership
  // If user doesn't meet criteria, don't render the dialog at all
  return null;
}

export default function FoundingPartnerCheckout() {
  return (
    <ThemeProvider forcedTheme="light">
      <CheckoutContent />
    </ThemeProvider>
  );
}
