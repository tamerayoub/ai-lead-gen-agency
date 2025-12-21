import { useMembership } from "@/hooks/useMembership";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { X, Crown, Zap, CreditCard } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export function MembershipPromotionBanner() {
  const { isFoundingPartner, isLoading } = useMembership();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user is an owner
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ['/api/organizations/current'],
  });

  const isOwner = currentOrg?.role === 'owner';

  // Don't show if loading or dismissed
  if (isLoading || isDismissed) {
    return null;
  }

  // Don't show banner if user is a founding partner
  if (isFoundingPartner) {
    return null;
  }

  return (
    <div className="border-b px-4 py-3" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.1), rgba(255, 223, 0, 0.15))', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isFoundingPartner && isOwner && (
            <>
              <Link href="/founding-partner-checkout">
                <Button 
                  size="sm" 
                  className="text-white hover:opacity-90 whitespace-nowrap"
                  style={{ backgroundColor: '#FFDF00' }}
                >
                  <Crown className="mr-1.5 h-3.5 w-3.5" />
                  Become a Founding Partner
                </Button>
              </Link>
              <Link href="/settings?tab=billing">
                <Button 
                  variant="outline"
                  size="sm" 
                  className="whitespace-nowrap"
                >
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                  View Billing Settings
                </Button>
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

