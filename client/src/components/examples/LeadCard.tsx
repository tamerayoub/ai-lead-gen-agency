import { LeadCard } from "../LeadCard";

export default function LeadCardExample() {
  return (
    <div className="grid gap-4 p-4 max-w-md">
      <LeadCard
        name="Sarah Johnson"
        email="sarah.j@email.com"
        phone="+1 555-0123"
        property="Sunset Apartments 2BR"
        status="new"
        source="email"
        aiHandled={true}
        lastContact="2 hours ago"
        onClick={() => console.log("Lead clicked")}
      />
      <LeadCard
        name="Michael Chen"
        email="m.chen@email.com"
        phone="+1 555-0456"
        property="Downtown Loft 1BR"
        status="prequalified"
        source="phone"
        aiHandled={true}
        lastContact="1 day ago"
        onClick={() => console.log("Lead clicked")}
      />
    </div>
  );
}
