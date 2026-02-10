import { useState } from "react";
import { Card } from "@/components/ui/card";

/**
 * Platform list matching landing-v1 integration section.
 * logoDomain: used for logo URL (Google favicon API).
 * logoUrl: optional override for higher-res or clearer logo (e.g. apple-touch-icon).
 */
const INTEGRATIONS: { name: string; logoDomain: string; logoUrl?: string }[] = [
  { name: "Apartments.com", logoDomain: "apartments.com" },
  { name: "Zillow", logoDomain: "zillow.com" },
  { name: "Realtor.com", logoDomain: "realtor.com" },
  { name: "Rent.com", logoDomain: "rent.com" },
  {
    name: "Apartment Finder",
    logoDomain: "apartmentfinder.com",
    logoUrl: "https://www.apartmentfinder.com/apple-touch-icon.png",
  },
  { name: "Rentals.com", logoDomain: "rentals.com" },
  { name: "HotPads", logoDomain: "hotpads.com" },
  { name: "Trulia", logoDomain: "trulia.com" },
  { name: "AppFolio", logoDomain: "appfolio.com" },
  { name: "Buildium", logoDomain: "buildium.com" },
  { name: "Yardi", logoDomain: "yardi.com" },
  { name: "Rent Manager", logoDomain: "rentmanager.com" },
  { name: "Propertyware", logoDomain: "propertyware.com" },
  { name: "Entrata", logoDomain: "entrata.com" },
  { name: "MRI Software", logoDomain: "mrisoftware.com" },
  { name: "RealPage", logoDomain: "realpage.com" },
  { name: "Gmail", logoDomain: "google.com" },
  { name: "Outlook", logoDomain: "microsoft.com" },
  { name: "Google Calendar", logoDomain: "google.com" },
  { name: "Facebook Messenger", logoDomain: "facebook.com" },
  { name: "Twilio SMS", logoDomain: "twilio.com" },
  { name: "Slack", logoDomain: "slack.com" },
  { name: "Microsoft Teams", logoDomain: "microsoft.com" },
  { name: "Zapier", logoDomain: "zapier.com" },
];

const LOGO_SIZE = 128;

/** Real logo URL via Google favicon API (works without API key; returns site icon). */
function getLogoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${LOGO_SIZE}`;
}

function LogoOrFallback({
  name,
  logoDomain,
  logoUrl,
  className,
}: {
  name: string;
  logoDomain: string;
  logoUrl?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const initial = name.charAt(0);
  const src = logoUrl ?? getLogoUrl(logoDomain);

  if (errored) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold ${className ?? "h-12 w-12"}`}
        aria-hidden
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`rounded-lg object-contain bg-white border border-border/50 ${className ?? "h-12 w-12"}`}
      onError={() => setErrored(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function IntegrationsMarqueeWithLogos({
  cardClassName = "",
  gradientFrom = "from-white",
  gradientTo = "to-transparent",
}: {
  cardClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
} = {}) {
  return (
    <div className="relative overflow-hidden py-4" data-testid="integrations-marquee-with-logos">
      <div
        className={`absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r ${gradientFrom} ${gradientTo} z-10 pointer-events-none`}
      />
      <div
        className={`absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l ${gradientFrom} ${gradientTo} z-10 pointer-events-none`}
      />
      <div className="flex animate-marquee gap-4" style={{ width: "max-content" }}>
        {INTEGRATIONS.map((platform) => (
          <div key={`${platform.name}-1`} className="flex-shrink-0">
            <Card
              className={`w-[180px] h-[120px] p-4 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border/50 bg-card ${cardClassName}`}
            >
              <div className="flex flex-col items-center gap-3 h-full justify-center">
                <LogoOrFallback name={platform.name} logoDomain={platform.logoDomain} logoUrl={platform.logoUrl} />
                <div className="text-sm font-semibold text-foreground">{platform.name}</div>
              </div>
            </Card>
          </div>
        ))}
        {INTEGRATIONS.map((platform) => (
          <div key={`${platform.name}-2`} className="flex-shrink-0">
            <Card
              className={`w-[180px] h-[120px] p-4 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border/50 bg-card ${cardClassName}`}
            >
              <div className="flex flex-col items-center gap-3 h-full justify-center">
                <LogoOrFallback name={platform.name} logoDomain={platform.logoDomain} logoUrl={platform.logoUrl} />
                <div className="text-sm font-semibold text-foreground">{platform.name}</div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
