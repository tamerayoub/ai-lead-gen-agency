import { LeadDetailSheet } from "../LeadDetailSheet";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LeadDetailSheetExample() {
  const [open, setOpen] = useState(true);

  const sampleLead = {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+1 555-0123",
    property: "Sunset Apartments 2BR",
    status: "prequalified" as const,
    income: "$85,000/year",
    moveInDate: "April 1, 2024",
    qualificationScore: 85,
    conversations: [
      {
        id: "1",
        type: "user" as const,
        channel: "email" as const,
        message: "Hi, I'm interested in the 2BR apartment. Is it still available?",
        timestamp: "2 hours ago",
      },
      {
        id: "2",
        type: "ai" as const,
        channel: "email" as const,
        message: "Hello! Yes, the 2BR apartment is available. It features modern amenities and a balcony. Monthly rent is $2,400. Would you like to schedule a viewing?",
        timestamp: "2 hours ago",
        aiGenerated: true,
      },
    ],
    notes: [
      {
        id: "1",
        content: "Lead shows strong interest. Income verified at $85k/year. Credit score pending.",
        timestamp: "1 hour ago",
        aiGenerated: true,
      },
    ],
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Lead Details</Button>
      <LeadDetailSheet open={open} onOpenChange={setOpen} lead={sampleLead} />
    </div>
  );
}
