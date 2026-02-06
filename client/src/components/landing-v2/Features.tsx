import { MessageSquare, Zap, Shield, BarChart3, Clock, Users } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    description: "All your Facebook Marketplace messages in one beautiful dashboard. Never miss a lead again.",
  },
  {
    icon: Zap,
    title: "Instant Sync",
    description: "Real-time synchronization means you see new messages the moment they arrive.",
  },
  {
    icon: Shield,
    title: "Secure Connection",
    description: "Your data stays yours. Bank-level encryption protects every conversation.",
  },
  {
    icon: BarChart3,
    title: "Lead Analytics",
    description: "Understand your pipeline with insights on response times, conversion rates, and more.",
  },
  {
    icon: Clock,
    title: "Smart Reminders",
    description: "Automated follow-up reminders ensure no opportunity slips through the cracks.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Assign leads, share notes, and work together to close more deals.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
            Features
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Everything You Need to{" "}
            <span className="text-gradient">Capture More Leads</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Our platform connects directly to Facebook Marketplace, giving you superpowers to manage and convert leads faster than ever.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card"
              data-testid={`card-feature-${i}`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
