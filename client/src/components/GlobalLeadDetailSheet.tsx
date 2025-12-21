import { useLeadSheet } from "@/contexts/LeadSheetContext";
import { LeadDetailSheet } from "./LeadDetailSheet";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface LeadDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  property: string;
  status: "new" | "contacted" | "qualified" | "toured" | "applied" | "approved" | "rejected" | "closed";
  income?: string;
  moveInDate?: string;
  qualificationScore?: number;
  conversations: Array<{
    id: string;
    type: "received" | "incoming" | "outgoing" | "sent" | "ai" | "user" | "system";
    channel: "email" | "sms" | "phone" | "system";
    message: string;
    timestamp: string;
    aiGenerated?: boolean;
    emailSubject?: string;
    sourceIntegration?: string;
  }>;
  notes: Array<{
    id: string;
    content: string;
    timestamp: string;
    aiGenerated: boolean;
  }>;
}

/**
 * Global Lead Detail Sheet that can be opened from anywhere in the app
 */
export function GlobalLeadDetailSheet() {
  const { selectedLeadId, closeLeadSheet } = useLeadSheet();
  const [, setLocation] = useLocation();

  const { data: lead, isLoading } = useQuery<LeadDetails>({
    queryKey: ["/api/leads", selectedLeadId],
    enabled: !!selectedLeadId,
  });

  return (
    <LeadDetailSheet
      open={!!selectedLeadId}
      onOpenChange={(open) => {
        if (!open) {
          closeLeadSheet();
        }
      }}
      onExpand={() => {
        if (selectedLeadId) {
          setLocation(`/leads/${selectedLeadId}`);
          closeLeadSheet();
        }
      }}
      lead={isLoading ? null : lead || null}
    />
  );
}
