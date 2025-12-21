import { useMembership } from "@/hooks/useMembership";
import { useLocation } from "wouter";
import { Lock, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_ROUTES_WITHOUT_MEMBERSHIP = [
  '/settings',
  '/team',
  '/accept-invitation',
  '/book-showing',
  '/showing',
  '/founding-partner'
];

interface MembershipGuardProps {
  children: React.ReactNode;
}

export function MembershipGuard({ children }: MembershipGuardProps) {
  const { isFoundingPartner, isLoading, status } = useMembership();
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Check if organization has a membership (active, cancelled but not expired, or past_due)
  const hasMembership = status === 'active' || status === 'cancelled' || status === 'past_due';
  
  // Get current organization to check if user is owner
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: !!user,
  });
  
  const isOwner = currentOrg?.role === 'owner';
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Fetch launch date from database (same as landing page)
  const { data: launchDateData } = useQuery<{ launchDate: string }>({
    queryKey: ["/api/launch-date"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch subscription status to check if it's a one-time payment org
  const { data: subscriptionData } = useQuery<{
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
    enabled: isFoundingPartner || hasMembership,
  });

  // Check if organization has one-time payment (active but no subscription)
  const isOneTimePayment = isFoundingPartner && !subscriptionData?.subscription;

  const launchDate = useMemo(() => {
    if (launchDateData?.launchDate) {
      return new Date(launchDateData.launchDate).getTime();
    }
    // Fallback to 1 month from now if not loaded yet
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
  }, [launchDateData]);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const difference = launchDate - now;

      if (difference > 0) {
        setTimeRemaining({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [launchDate]);

  const isRouteAllowed = ALLOWED_ROUTES_WITHOUT_MEMBERSHIP.some(route => 
    location.startsWith(route)
  );

  if (isLoading) {
    return null;
  }

  // For allowed routes, always show content
  if (isRouteAllowed) {
    return <>{children}</>;
  }

  // If organization has a membership (even if cancelled or past_due), show the content
  if (hasMembership) {
    return <>{children}</>;
  }

  // Show a single coming-soon view instead of per-section content
  return (
    <div className="min-h-screen flex items-start justify-center bg-background pt-8 md:pt-16">
      <Card className="max-w-xl w-full mx-4 shadow-xl border-2" style={{ borderColor: 'rgba(255, 223, 0, 0.3)' }}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)' }}>
            <Lock className="h-6 w-6" style={{ color: '#FFDF00' }} />
          </div>
          <CardTitle>Features Coming Soon</CardTitle>
          <CardDescription>
            As a founding partner, you'll be the first to access premium features when they launch!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Countdown Timer */}
          <div className="p-4 rounded-lg border" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.1), rgba(255, 223, 0, 0.15))', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
                <Rocket className="h-4 w-4" />
                <span className="text-xs font-semibold">Launch Countdown</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                  {String(timeRemaining.days).padStart(2, '0')}
                </div>
                <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wide">Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                  {String(timeRemaining.hours).padStart(2, '0')}
                </div>
                <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wide">Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </div>
                <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wide">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </div>
                <div className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wide">Seconds</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isOwner ? (
              <>
                {/* Hide button for one-time payment organizations (active but no subscription) */}
                {!isOneTimePayment && (
                  <Link href="/founding-partner-checkout">
                    <Button 
                      className="w-full text-white hover:opacity-90"
                      style={{ background: '#FFDF00' }}
                      data-testid="button-upgrade-guard"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Start Your Membership
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-700 mb-2">
                  To unlock all features, your organization needs a Founding Partner membership.
                </p>
                <p className="text-xs text-gray-600">
                  Please contact your organization owner to start a membership.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
