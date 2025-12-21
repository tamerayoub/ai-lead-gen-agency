// Team member color palette for calendar events
const TEAM_COLORS = [
  {
    light: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500",
    bg: "bg-blue-500",
    badge: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500",
  },
  {
    light: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500",
    bg: "bg-purple-500",
    badge: "bg-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500",
  },
  {
    light: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500",
    bg: "bg-green-500",
    badge: "bg-green-500",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-500",
  },
  {
    light: "bg-yellow-600/10 text-yellow-800 dark:text-yellow-400 border-yellow-600",
    bg: "bg-yellow-600",
    badge: "bg-yellow-600",
    text: "text-yellow-800 dark:text-yellow-400",
    border: "border-yellow-600",
  },
  {
    light: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500",
    bg: "bg-pink-500",
    badge: "bg-pink-500",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-500",
  },
  {
    light: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500",
    bg: "bg-cyan-500",
    badge: "bg-cyan-500",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-500",
  },
  {
    light: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500",
    bg: "bg-yellow-500",
    badge: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-500",
  },
  {
    light: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500",
    bg: "bg-indigo-500",
    badge: "bg-indigo-500",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-500",
  },
];

// Color for Lead2Lease showings
const LEAD2LEASE_COLOR = {
  light: "bg-primary/10 text-primary border-primary",
  bg: "bg-primary",
  badge: "bg-primary",
  text: "text-primary",
  border: "border-primary",
};

// Color for unassigned calendar events
const UNASSIGNED_COLOR = {
  light: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500",
  bg: "bg-gray-500",
  badge: "bg-gray-500",
  text: "text-gray-700 dark:text-gray-300",
  border: "border-gray-500",
};

export function getMemberColor(userId: string | null, membersList: Array<{ id: string }>) {
  if (!userId) return UNASSIGNED_COLOR; // Neutral color for unassigned events

  const memberIndex = membersList.findIndex((m) => m.id === userId);
  if (memberIndex === -1) return UNASSIGNED_COLOR; // Unknown user gets neutral color

  return TEAM_COLORS[memberIndex % TEAM_COLORS.length];
}

export function getShowingColor() {
  return LEAD2LEASE_COLOR;
}

export function getProviderDisplayName(provider: string): string {
  const providerMap: Record<string, string> = {
    google: "Google Calendar",
    outlook: "Outlook Calendar",
    icloud: "iCloud Calendar",
  };
  return providerMap[provider] || provider;
}
