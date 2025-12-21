import { useQuery } from "@tanstack/react-query";

export interface MembershipStatus {
  isFoundingPartner: boolean;
  status: 'none' | 'active' | 'cancelled' | 'past_due' | 'expired';
  currentPeriodEnd: string | null;
  isCancelled: boolean;
  orgName?: string;
  orgImage?: string;
  hasCompletedOnboarding?: boolean;
}

export function useMembership() {
  const { data, isLoading, error, refetch } = useQuery<MembershipStatus>({
    queryKey: ["/api/membership/status"],
    staleTime: 0, // Always fetch fresh data to ensure membership status is up to date
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    isFoundingPartner: data?.isFoundingPartner ?? false,
    status: data?.status ?? 'none',
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    isCancelled: data?.isCancelled ?? false,
    orgName: data?.orgName,
    orgImage: data?.orgImage,
    hasCompletedOnboarding: data?.hasCompletedOnboarding ?? false,
    isLoading,
    error,
    refetch,
  };
}
