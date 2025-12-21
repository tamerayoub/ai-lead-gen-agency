import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, Zap, Settings2, Save, CreditCard, Crown, ExternalLink, Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  
  // Handle tab navigation from URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    // Prevent access to locked tabs
    const lockedTabs = ['ai-training', 'responses', 'automation', 'integrations'];
    if (tabParam && lockedTabs.includes(tabParam)) {
      return 'billing'; // Default to billing if trying to access locked tab
    }
    return tabParam || 'billing'; // Default to billing
  });

  // Prevent switching to locked tabs
  const handleTabChange = (value: string) => {
    const lockedTabs = ['ai-training', 'responses', 'automation', 'integrations'];
    if (lockedTabs.includes(value)) {
      return; // Don't allow switching to locked tabs
    }
    setActiveTab(value);
  };

  // Use membership hook to check subscription status
  const { isFoundingPartner, status: membershipStatus, currentPeriodEnd, isLoading: membershipLoading, refetch: refetchMembership } = useMembership();
  
  // Check if organization has a membership (active, cancelled but not expired, or past_due)
  const hasMembership = membershipStatus === 'active' || membershipStatus === 'cancelled' || membershipStatus === 'past_due';
  
  // Check if user is owner of current organization
  const { data: currentOrg, isLoading: currentOrgLoading } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: isAuthenticated, // Only fetch when user is authenticated
  });
  
  // Show billing tab if user is owner (check role when available, default to false only when we're sure they're not owner)
  const isOwner = currentOrg?.role === 'owner';
  
  // Refetch membership status when tab changes to billing
  useEffect(() => {
    if (activeTab === 'billing') {
      refetchMembership();
    }
  }, [activeTab, refetchMembership]);
  
  // Also fetch detailed subscription info for billing page
  const { data: subscriptionData, isLoading: subscriptionLoading, error: subscriptionError } = useQuery<{
    hasSubscription: boolean;
    subscription: {
      id: string;
      status: string;
      currentPeriodEnd: string | null;
      currentPeriodStart: string | null;
      cancelAtPeriodEnd: boolean;
      plan: string;
      amount: number;
    } | null;
  }>({
    queryKey: ["/api/stripe/subscription-status"],
    enabled: isFoundingPartner || hasMembership, // Fetch if user is a founding partner OR has membership
    onSuccess: (data) => {
      console.log('[Settings] ✅ Subscription data received:', JSON.stringify(data, null, 2));
      console.log('[Settings] cancelAtPeriodEnd:', data?.subscription?.cancelAtPeriodEnd);
      console.log('[Settings] currentPeriodEnd:', data?.subscription?.currentPeriodEnd);
    },
    onError: (error) => {
      console.error('[Settings] ❌ Error fetching subscription data:', error);
    },
  });
  
  // Log when subscriptionData changes
  useEffect(() => {
    console.log('[Settings] useEffect - subscriptionData changed:', {
      subscriptionData,
      isLoading: subscriptionLoading,
      error: subscriptionError,
      isFoundingPartner,
    });
  }, [subscriptionData, subscriptionLoading, subscriptionError, isFoundingPartner]);

  // Fetch founding partner price from Stripe for fallback display
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
  
  // Determine if user has subscription based on membership status
  const hasSubscription = isFoundingPartner && (membershipStatus === 'active' || membershipStatus === 'cancelled');
  
  // Check if this is a one-time payment organization (active but no subscription)
  // Only check if subscriptionData has been loaded (not loading and not error)
  const isOneTimePayment = isFoundingPartner && 
                            !subscriptionLoading && 
                            !subscriptionError && 
                            subscriptionData !== undefined &&
                            !subscriptionData?.subscription;
  
  // Log billing section debug info
  useEffect(() => {
    console.log('[Settings Billing] ===== BILLING SECTION DEBUG =====');
    console.log('[Settings Billing] isFoundingPartner:', isFoundingPartner);
    console.log('[Settings Billing] membershipStatus:', membershipStatus);
    console.log('[Settings Billing] hasSubscription:', hasSubscription);
    console.log('[Settings Billing] subscriptionLoading:', subscriptionLoading);
    console.log('[Settings Billing] subscriptionError:', subscriptionError);
    console.log('[Settings Billing] subscriptionData:', subscriptionData);
    console.log('[Settings Billing] subscriptionData?.subscription:', subscriptionData?.subscription);
    console.log('[Settings Billing] subscriptionData?.hasSubscription:', subscriptionData?.hasSubscription);
    console.log('[Settings Billing] isOneTimePayment:', isOneTimePayment);
    console.log('[Settings Billing] displayPrice:', displayPrice);
    console.log('[Settings Billing] Condition check - hasSubscription && (subscriptionData?.subscription || isFoundingPartner):', hasSubscription && (subscriptionData?.subscription || isFoundingPartner));
    console.log('[Settings Billing] ===== END DEBUG =====');
  }, [isFoundingPartner, membershipStatus, hasSubscription, subscriptionData, subscriptionLoading, subscriptionError, isOneTimePayment, displayPrice]);

  const handleManagePayment = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please log in to manage your subscription.",
        variant: "destructive",
      });
      return;
    }

    setIsPortalLoading(true);
    try {
      // Get current organization ID to ensure we manage the correct subscription
      const currentOrgId = currentOrg?.orgId;
      
      const res = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include session cookie for authentication
        body: JSON.stringify({
          ...(currentOrgId && { orgId: currentOrgId }), // Pass current org ID to ensure correct subscription
          returnUrl: '/app/settings?tab=billing', // Return to settings billing tab after Stripe portal
        }),
      });
      const data = await res.json();
      
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else if (res.status === 401) {
        toast({
          title: "Session expired",
          description: "Please log in again to manage your subscription.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "No subscription found",
          description: "We couldn't find an active subscription for your account.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPortalLoading(false);
    }
  };
  
  const [greetingTemplate, setGreetingTemplate] = useState("");
  const [followupTemplate, setFollowupTemplate] = useState("");
  const [minIncome, setMinIncome] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [requireRefs, setRequireRefs] = useState(false);
  
  const [responseTone, setResponseTone] = useState("professional");
  const [responseSpeed, setResponseSpeed] = useState("immediate");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [suggestTours, setSuggestTours] = useState(true);
  
  const [autoRespond, setAutoRespond] = useState(true);
  const [followup24h, setFollowup24h] = useState(true);
  const [autoSendApp, setAutoSendApp] = useState(false);
  const [maxFollowups, setMaxFollowups] = useState("3");
  const [autoPilotMode, setAutoPilotMode] = useState(false);
  

  const { data: responseSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/responses"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/responses");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setGreetingTemplate(settings.greeting_template || "");
        setFollowupTemplate(settings.followup_template || "");
      }
      return data;
    }
  });
  
  const { data: qualificationSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/qualification"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/qualification");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setMinIncome(settings.min_income || "");
        setCreditScore(settings.credit_score || "");
        setPetsAllowed(settings.pets_allowed === "true");
        setRequireRefs(settings.require_refs === "true");
      }
      return data;
    }
  });


  const saveSettingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ai-settings", data),
    onSuccess: (_, variables) => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/ai-settings/${variables.category}`] });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveTemplates = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "responses", key: "greeting_template", value: greetingTemplate });
      await saveSettingMutation.mutateAsync({ category: "responses", key: "followup_template", value: followupTemplate });
      toast({ title: "Templates saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save templates", variant: "destructive" });
    }
  };

  const saveCriteria = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "min_income", value: minIncome });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "credit_score", value: creditScore });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "pets_allowed", value: petsAllowed.toString() });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "require_refs", value: requireRefs.toString() });
      toast({ title: "Qualification criteria saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save criteria", variant: "destructive" });
    }
  };

  const saveBehavior = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_tone", value: responseTone });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_speed", value: responseSpeed });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "include_details", value: includeDetails.toString() });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "suggest_tours", value: suggestTours.toString() });
      toast({ title: "Response behavior saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save behavior", variant: "destructive" });
    }
  };

  const saveAutomation = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_respond", value: autoRespond.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "followup_24h", value: followup24h.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_send_app", value: autoSendApp.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "max_followups", value: maxFollowups });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_pilot_mode", value: autoPilotMode.toString() });
      toast({ title: "Automation rules saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save automation", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your AI assistant and system preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <TabsList className={`inline-flex w-full md:grid md:w-full ${isOwner ? 'md:grid-cols-5' : 'md:grid-cols-4'} h-auto min-w-max md:min-w-0`}>
            <TabsTrigger value="ai-training" data-testid="tab-ai-training" disabled className="opacity-50 cursor-not-allowed whitespace-nowrap flex-shrink-0">
              <Brain className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="text-xs md:text-sm">AI Training</span>
              <span className="ml-1 text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
            <TabsTrigger value="responses" data-testid="tab-responses" disabled className="opacity-50 cursor-not-allowed whitespace-nowrap flex-shrink-0">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="text-xs md:text-sm">Responses</span>
              <span className="ml-1 text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
            <TabsTrigger value="automation" data-testid="tab-automation" disabled className="opacity-50 cursor-not-allowed whitespace-nowrap flex-shrink-0">
              <Zap className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="text-xs md:text-sm">Automation</span>
              <span className="ml-1 text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
          {isOwner && (
              <TabsTrigger value="billing" data-testid="tab-billing" className="whitespace-nowrap flex-shrink-0">
                <CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="text-xs md:text-sm">Billing</span>
            </TabsTrigger>
          )}
            <TabsTrigger value="integrations" data-testid="tab-integrations" disabled className="opacity-50 cursor-not-allowed whitespace-nowrap flex-shrink-0">
              <Settings2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="text-xs md:text-sm">Integrations</span>
              <span className="ml-1 text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="ai-training" className="mt-6 space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  AI Training features are coming soon. Stay tuned!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-6 space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  Response configuration features are coming soon. Stay tuned!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  Automation features are coming soon. Stay tuned!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isOwner && (
          <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" style={{ color: '#FFDF00' }} />
                Subscription & Billing
              </CardTitle>
              <CardDescription>Manage your payment methods, billing details, and subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(subscriptionLoading || membershipLoading) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (hasSubscription && (subscriptionData?.subscription || isFoundingPartner)) || isOneTimePayment ? (
                <>
                  {/* Membership Status - Show for both subscriptions and one-time payments */}
                  {(subscriptionData?.subscription || isOneTimePayment) && (
                  <>
                  <div className="p-4 rounded-lg border dark:border-yellow-500/30" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.1), rgba(255, 223, 0, 0.15))' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <Crown className="h-8 w-8" style={{ color: '#FFDF00' }} />
                        <div>
                          <h3 className="font-semibold text-lg text-foreground dark:text-yellow-400">Founding Partner</h3>
                          <p className="text-sm font-medium text-foreground dark:text-gray-200">
                            {isOneTimePayment
                              ? `$${displayPrice} upfront, then monthly recurring payments begin post-launch`
                              : `$${subscriptionData?.subscription ? (subscriptionData.subscription.amount / 100).toFixed(2) : displayPrice}/month`}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          subscriptionData?.subscription?.cancelAtPeriodEnd 
                            ? 'secondary' 
                            : membershipStatus === 'active' 
                            ? 'default' 
                            : 'secondary'
                        }
                        className={
                          subscriptionData?.subscription?.cancelAtPeriodEnd
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : membershipStatus === 'active' 
                            ? 'bg-green-500 text-white' 
                            : ''
                        }
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {subscriptionData?.subscription?.cancelAtPeriodEnd && subscriptionData?.subscription?.currentPeriodEnd
                          ? `Ending Soon (${format(new Date(subscriptionData.subscription.currentPeriodEnd), 'MMM d, yyyy')})`
                          : membershipStatus === 'active' 
                          ? 'Active' 
                          : membershipStatus === 'cancelled' 
                          ? 'Cancelled (Active until period end)' 
                          : membershipStatus}
                      </Badge>
                    </div>
                    
                    {/* Show cancellation notice only if subscription is set to cancel at period end (not immediately cancelled) */}
                    {(() => {
                      // Only show for subscriptions, not one-time payments
                      if (isOneTimePayment) {
                        return null;
                      }
                      
                      // Check if subscription is cancelled at period end (different from immediate cancellation)
                      const subscriptionStatus = subscriptionData?.subscription?.status;
                      const cancelAtPeriodEnd = subscriptionData?.subscription?.cancelAtPeriodEnd === true;
                      const isCancelledImmediately = subscriptionStatus === 'canceled' && !cancelAtPeriodEnd;
                      const isCancelledAtPeriodEnd = (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && cancelAtPeriodEnd;
                      
                      // Only show notice if cancelled at period end (not immediately)
                      if (!isCancelledAtPeriodEnd || isCancelledImmediately) {
                        return null;
                      }
                      
                      // Determine the end date - prefer subscription data, fallback to currentPeriodEnd from membership hook
                      const endDate = subscriptionData?.subscription?.currentPeriodEnd 
                        ? subscriptionData.subscription.currentPeriodEnd 
                        : currentPeriodEnd;
                      
                      if (!endDate) {
                        return null;
                      }
                      
                      return (
                        <div className="mt-3 p-3 dark:opacity-30 rounded-md flex items-start gap-2 border-2" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', borderColor: 'rgba(255, 223, 0, 0.4)' }}>
                          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#CCB300' }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold dark:text-gray-200 mb-1" style={{ color: '#CCB300' }}>
                              Your service will end on {format(new Date(endDate), 'MMMM d, yyyy')}.
                            </p>
                            <p className="text-sm dark:text-gray-200" style={{ color: '#CCB300' }}>
                              Your subscription is scheduled to cancel at the end of the current billing period. You'll continue to have access until then.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <Separator />
                  </>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Manage Subscription</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Manage your subscription, payment methods, view invoices, cancel your subscription, and more.
                      </p>
                      <Button 
                        onClick={handleManagePayment}
                        disabled={isPortalLoading}
                        data-testid="button-manage-subscription"
                      >
                        {isPortalLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Opening...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Manage Subscription
                            <ExternalLink className="h-3 w-3 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* No subscription - Show option to start membership if owner */
                <div className="text-center py-8">
                  {isFoundingPartner ? (
                    <>
                      <p className="text-muted-foreground mb-4">
                        Your membership status is being verified. Please wait a moment or refresh.
                      </p>
                      <Button 
                        onClick={async () => {
                          await refetchMembership();
                          toast({
                            title: "Refreshing membership status",
                            description: "Please wait a moment...",
                          });
                        }}
                        className="text-white hover:opacity-90"
                        style={{ backgroundColor: '#FFDF00' }}
                      >
                        <Loader2 className="h-4 w-4 mr-2" />
                        Refresh Membership Status
                      </Button>
                    </>
                  ) : hasMembership ? (
                    <>
                      <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: '#FFDF00' }} />
                      <h3 className="font-semibold text-lg mb-2">Billing Information</h3>
                      <p className="text-muted-foreground mb-4">
                        Subscription information is loading. Please refresh if it doesn't appear shortly.
                      </p>
                      <Button
                        onClick={async () => {
                          await refetchMembership();
                          queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription-status"] });
                        }}
                        className="text-white hover:opacity-90"
                        style={{ backgroundColor: '#FFDF00' }}
                      >
                        <Loader2 className="h-4 w-4 mr-2" />
                        Refresh Membership Status
                      </Button>
                    </>
                  ) : (
                    <>
                      <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No Active Membership</h3>
                      <p className="text-muted-foreground mb-4">
                        Your organization doesn't have an active Founding Partner membership. Start a membership to unlock all premium features and early access.
                      </p>
                      {/* Hide button for one-time payment organizations (active but no subscription) */}
                      {!isOneTimePayment && (
                        <Button asChild className="text-white hover:opacity-90" style={{ backgroundColor: '#FFDF00' }} data-testid="button-start-founding-partner">
                          <a href="/founding-partner-checkout">
                            <Crown className="h-4 w-4 mr-2" />
                            Start Founding Partner Membership
                          </a>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {!currentOrgLoading && currentOrg && !isOwner && activeTab === 'billing' && (
          <TabsContent value="billing" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing Access Restricted
                </CardTitle>
                <CardDescription>Only organization owners can manage billing</CardDescription>
              </CardHeader>
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Billing management is restricted to organization owners only. Please contact your organization owner to manage subscription and billing.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Settings2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-lg mb-2">Coming Soon</h3>
              <p className="text-muted-foreground">
                  Integration settings are coming soon. Stay tuned!
              </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
