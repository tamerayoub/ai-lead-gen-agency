import { LeadPipeline } from "../LeadPipeline";

export default function LeadPipelineExample() {
  const stages = [
    {
      stage: "new" as const,
      title: "New",
      count: 8,
      color: "bg-status-new text-white",
      leads: [
        { id: "1", name: "Sarah Johnson", property: "Sunset Apt 2BR", value: "$2,400/mo" },
        { id: "2", name: "Mike Davis", property: "Downtown Loft", value: "$2,800/mo" },
      ],
    },
    {
      stage: "contacted" as const,
      title: "Contacted",
      count: 12,
      color: "bg-status-contacted text-white",
      leads: [
        { id: "3", name: "Emma Wilson", property: "Garden View 3BR", value: "$3,200/mo" },
        { id: "4", name: "James Lee", property: "Parkside Studio", value: "$1,800/mo" },
      ],
    },
    {
      stage: "prequalified" as const,
      title: "Pre-qualified",
      count: 6,
      color: "bg-status-prequalified text-white",
      leads: [
        { id: "5", name: "Lisa Anderson", property: "Riverside 2BR", value: "$2,600/mo" },
      ],
    },
    {
      stage: "application" as const,
      title: "Application Sent",
      count: 4,
      color: "bg-status-application text-white",
      leads: [
        { id: "6", name: "Robert Taylor", property: "Hilltop 1BR", value: "$2,200/mo" },
      ],
    },
    {
      stage: "approved" as const,
      title: "Approved",
      count: 3,
      color: "bg-status-approved text-white",
      leads: [
        { id: "7", name: "Jennifer Moore", property: "Lakeside 2BR", value: "$2,900/mo" },
      ],
    },
  ];

  return (
    <div className="p-4">
      <LeadPipeline stages={stages} />
    </div>
  );
}
