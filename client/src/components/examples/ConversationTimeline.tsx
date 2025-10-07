import { ConversationTimeline } from "../ConversationTimeline";

export default function ConversationTimelineExample() {
  const messages = [
    {
      id: "1",
      type: "user" as const,
      channel: "email" as const,
      message: "Hi, I'm interested in the 2BR apartment at Sunset Apartments. Is it still available?",
      timestamp: "2 hours ago",
    },
    {
      id: "2",
      type: "ai" as const,
      channel: "email" as const,
      message: "Hello! Yes, the 2BR apartment is still available. It features modern amenities, in-unit laundry, and a balcony. The monthly rent is $2,400. Would you like to schedule a viewing?",
      timestamp: "2 hours ago",
      aiGenerated: true,
    },
    {
      id: "3",
      type: "user" as const,
      channel: "email" as const,
      message: "Yes, I'd love to see it. What times are available this week?",
      timestamp: "1 hour ago",
    },
  ];

  return (
    <div className="p-4 max-w-2xl">
      <ConversationTimeline messages={messages} />
    </div>
  );
}
