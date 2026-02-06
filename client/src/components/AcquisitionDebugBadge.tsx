/**
 * Dev-only debug badge showing acquisition attribution.
 * Only renders in non-production (localhost, replit, etc.).
 * Uses userAttribution from API when logged in, else client-side context.
 */
import { getAcquisitionContext } from "@/lib/acquisition";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export interface UserAttribution {
  initialOffer?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  landingPage?: string | null;
}

const isNonProduction = (): boolean => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".replit.dev") ||
    h.endsWith(".repl.co") ||
    h.includes(".riker.replit.dev")
  );
};

export function AcquisitionDebugBadge({ userAttribution }: { userAttribution?: UserAttribution | null }) {
  const [collapsed, setCollapsed] = useState(true);
  const { data: ctx } = useQuery({
    queryKey: ["acquisition-debug"],
    queryFn: () => getAcquisitionContext(),
    staleTime: 60_000,
  });

  if (!isNonProduction()) return null;
  if (!userAttribution && !ctx) return null;

  const offer = userAttribution?.initialOffer ?? ctx?.offer;
  const source = userAttribution?.utmSource ?? ctx?.source;
  const campaign = userAttribution?.utmCampaign ?? ctx?.campaign;
  const landing = userAttribution?.landingPage ?? ctx?.landing_page;

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] rounded-lg border border-amber-500/50 bg-amber-950/95 px-2 py-1.5 font-mono text-xs text-amber-100 shadow-lg"
      style={{ maxWidth: "320px" }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-semibold text-amber-400">Acquisition</span>
        <span className="text-amber-600">{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <dl className="mt-2 space-y-1 border-t border-amber-700/50 pt-2">
          <div>
            <dt className="text-amber-600">Offer</dt>
            <dd className="truncate">{offer || "—"}</dd>
          </div>
          <div>
            <dt className="text-amber-600">Source</dt>
            <dd className="truncate">{source || "—"}</dd>
          </div>
          <div>
            <dt className="text-amber-600">Campaign</dt>
            <dd className="truncate">{campaign || "—"}</dd>
          </div>
          <div>
            <dt className="text-amber-600">Landing</dt>
            <dd className="truncate">{landing || "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
