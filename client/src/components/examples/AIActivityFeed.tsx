import { AIActivityFeed } from "../AIActivityFeed";

export default function AIActivityFeedExample() {
  const activities = [
    {
      id: "1",
      type: "response" as const,
      channel: "email" as const,
      leadName: "Sarah Johnson",
      action: "Responded to inquiry about 2BR apartment",
      timestamp: "5 min ago",
      status: "success" as const,
    },
    {
      id: "2",
      type: "followup" as const,
      channel: "sms" as const,
      leadName: "Mike Davis",
      action: "Sent follow-up about viewing appointment",
      timestamp: "15 min ago",
      status: "success" as const,
    },
    {
      id: "3",
      type: "qualification" as const,
      channel: "phone" as const,
      leadName: "Emma Wilson",
      action: "Pre-qualified lead based on income verification",
      timestamp: "1 hour ago",
      status: "success" as const,
    },
    {
      id: "4",
      type: "note" as const,
      channel: "email" as const,
      leadName: "James Lee",
      action: "Generated conversation summary and next steps",
      timestamp: "2 hours ago",
      status: "success" as const,
    },
  ];

  return (
    <div className="p-4 max-w-2xl">
      <AIActivityFeed activities={activities} />
    </div>
  );
}
