import { motion } from "framer-motion";
import { MessageSquare, Users, Home, ArrowRight, Database, Reply } from "lucide-react";

const dataItems = [
  { icon: Users, label: "New Lead", sublabel: "John D. - 2BR Apt", color: "bg-primary" },
  { icon: Home, label: "Listing Match", sublabel: "Unit 4B - $1,450/mo", color: "bg-brand-light" },
  { icon: MessageSquare, label: "Conversation", sublabel: "\"Is this still available?\"", color: "bg-brand-dark" },
  { icon: Reply, label: "Auto-Reply", sublabel: "\"Yes! Schedule a tour?\"", color: "bg-primary" },
  { icon: Database, label: "Lead History", sublabel: "Profile + all messages", color: "bg-brand-light" },
];

export function IntegrationFlow() {
  return (
    <section id="how-it-works" className="relative py-24 bg-card overflow-hidden" data-testid="integration-flow-section">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-foreground sm:text-5xl" data-testid="heading-integration-flow-v3">
            Seamless <span className="text-gradient-brand">Multi-Channel Integration</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground" data-testid="text-integration-flow-description-v3">
            Leads, listings, and conversations flow directly from every channel into your leasing pipeline
          </p>
        </motion.div>

        <div className="relative mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_1.5fr_1fr]">
            <motion.div
              className="relative rounded-2xl border-2 border-primary/20 bg-accent p-6 shadow-card"
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              data-testid="panel-inbound-channels"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-foreground" data-testid="text-inbound-title">Inbound</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-inbound-subtitle">Channels</p>
                </div>
              </div>
              <div className="space-y-2">
                {["Email", "SMS", "Phone", "Listings"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-card p-2.5 text-sm font-medium text-foreground shadow-sm" data-testid={`text-channel-${item.toLowerCase()}`}>
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative flex flex-col items-center justify-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-primary/40 via-primary to-primary/40 hidden md:block" />

              <div className="relative z-10 space-y-3 w-full">
                {dataItems.map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card hover-elevate"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    data-testid={`flow-item-${i}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <item.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground" data-testid={`text-flow-label-${i}`}>{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground" data-testid={`text-flow-sublabel-${i}`}>{item.sublabel}</p>
                    </div>
                    <motion.div
                      animate={{ x: [0, 6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    >
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative rounded-2xl border-2 border-primary/20 bg-accent p-6 shadow-card"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              data-testid="panel-crm-output"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand animate-pulse-glow">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-foreground" data-testid="text-crm-title">Lead2Lease</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-crm-subtitle">CRM</p>
                </div>
              </div>
              <div className="space-y-2">
                {["Lead Pipeline", "Auto-Responses", "Showing Calendar", "Analytics"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-card p-2.5 text-sm font-medium text-foreground shadow-sm" data-testid={`text-crm-${item.toLowerCase().replace(/\s+/g, "-")}`}>
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
