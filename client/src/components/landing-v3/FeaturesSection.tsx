import { motion } from "framer-motion";
import { MessageSquare, Users, History, Reply, Home, Shield } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Capture Every Lead",
    description: "Automatically import leads from email, SMS, and listing platforms into your pipeline. No manual entry required.",
  },
  {
    icon: Home,
    title: "Property Portfolio",
    description: "Manage your entire property inventory with unit-level detail, availability tracking, and listing syndication.",
  },
  {
    icon: MessageSquare,
    title: "AI-Powered Responses",
    description: "Intelligent auto-replies handle initial inquiries, pre-qualify leads, and schedule showings around the clock.",
  },
  {
    icon: History,
    title: "Complete Lead History",
    description: "Store every conversation, showing, and interaction. See the full journey from inquiry to signed lease.",
  },
  {
    icon: Reply,
    title: "Multi-Channel Outreach",
    description: "Communicate via email, SMS, and phone from a single dashboard. Every message tracked and organized.",
  },
  {
    icon: Shield,
    title: "Smart Qualification",
    description: "AI-driven lead scoring and customizable qualification criteria ensure you focus on the highest-value prospects.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-background" data-testid="features-section-v3">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-foreground sm:text-5xl" data-testid="heading-features-v3">
            Everything You Need to <span className="text-gradient-brand">Convert Leads</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground" data-testid="text-features-description-v3">
            A complete AI-powered platform built for property management teams
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 shadow-card hover-elevate"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              data-testid={`feature-card-v3-${i}`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-foreground" data-testid={`text-feature-title-${i}`}>{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground" data-testid={`text-feature-desc-${i}`}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
