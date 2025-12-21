import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/**
 * Global handler for membership revocation detection
 * Checks for revocation flag and handles automatic org switching or error display
 */
export function useMembershipRevocationHandler() {
  const { toast } = useToast();

  useEffect(() => {
    const membershipRevoked = sessionStorage.getItem("membershipRevoked");
    if (membershipRevoked === "true") {
      // Clear the flag immediately to prevent redirect loops
      sessionStorage.removeItem("membershipRevoked");
      
      // Fetch user's organizations to see if they have others
      fetch("/api/organizations", { credentials: "include" })
        .then(async (res) => {
          // Check response status before parsing
          if (!res.ok) {
            throw new Error(`Failed to fetch organizations: ${res.status}`);
          }
          return res.json();
        })
        .then((orgs: Array<{ orgId: string; orgName: string }>) => {
          // Clear all queries to force refetch
          queryClient.clear();
          
          if (orgs.length > 0) {
            // User has other organizations - show toast with org switcher guidance
            toast({
              title: "Access Removed",
              description: `You have been removed from this organization. You have ${orgs.length} other organization(s). Please use the organization switcher to select one.`,
              variant: "destructive",
              duration: 10000, // Show for 10 seconds
            });
          } else {
            // No other organizations available
            toast({
              title: "Access Removed",
              description: "You have been removed from this organization by an administrator. You are not a member of any other organizations.",
              variant: "destructive",
              duration: 10000,
            });
          }
        })
        .catch((error) => {
          // If fetch fails, clear cache and show a generic error
          queryClient.clear();
          console.error("Failed to handle membership revocation:", error);
          toast({
            title: "Access Removed",
            description: "You have been removed from this organization by an administrator.",
            variant: "destructive",
          });
        });
    }
  }, [toast]);
}
