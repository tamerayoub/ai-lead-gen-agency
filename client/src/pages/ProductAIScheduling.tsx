import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Calendar,
  Clock,
  Users,
  BellRing,
  RefreshCw,
  ShieldCheck,
  Phone,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SchedulingDemo from "@/components/v6/SchedulingDemo";

const BRAND = "Agency";

const valueProps = [
  {
    icon: Calendar,
    title: "Done-For-You Setup",
    description: "We configure and integrate your AI scheduling system end-to-end — no technical work required on your end.",
  },
  {
    icon: Clock,
    title: "Books 24/7 Automatically",
    description: "Leads book themselves any time of day or night. Your calendar fills up while you focus on your business.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Calendar Sync",
    description: "Two-way sync with Google and Outlook ensures zero double-bookings and always up-to-date availability.",
  },
  {
    icon: ShieldCheck,
    title: "No Results? Money Back",
    description: "If you don't see measurable improvements in bookings, we'll refund you in full. No questions asked.",
  },
];

const stats = [
  { value: "113%", label: "More Appointments Set" },
  { value: "62%", label: "More Tours Year-Over-Year" },
  { value: "150%", label: "Faster Time to Tour" },
  { value: "24/7", label: "Always Available" },
];

const steps = [
  {
    step: "01",
    icon: Phone,
    title: "Lead Reaches Out",
    desc: "A prospect calls, texts, or fills out a form. Our AI immediately engages them and checks your real-time availability.",
  },
  {
    step: "02",
    icon: Calendar,
    title: "AI Qualifies & Books",
    desc: "The AI asks the right questions, qualifies the lead, and slots them into the perfect opening on your calendar.",
  },
  {
    step: "03",
    icon: BellRing,
    title: "You Show Up & Close",
    desc: "You get a notification with all lead details. They get a confirmation and reminder. Everyone wins.",
  },
];

const features = [
  "Back-to-back showing batches",
  "Group showing support",
  "Travel time buffers",
  "Open house scheduler",
  "Multi-agent assignment",
  "Auto-distribute showings",
  "Tenant notifications",
  "Conflict prevention",
];

const testimonials = [
  {
    name: "James Patterson",
    role: "Owner, Patterson Services",
    text: "We went from missing 40% of calls to booking every single one. Revenue jumped 35% in the first month alone.",
    stars: 5,
  },
  {
    name: "Maria Gonzalez",
    role: "Manager, Bright Solutions Co.",
    text: "The AI books appointments better than my front desk ever did. Our team can finally focus on the actual work.",
    stars: 5,
  },
  {
    name: "David Chen",
    role: "Owner, Chen & Associates",
    text: "Setup was completely hands-off. Within 48 hours the AI was filling my calendar. I didn't touch a thing.",
    stars: 5,
  },
];

function SchedulingHeader() {
  return (
    <nav
      className="v6-page fixed top-0 left-0 right-0 z-50 border-b border-border/50 v6-glass"
      data-testid="scheduling-header"
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg v6-bg-gradient flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">{BRAND}</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <div className="relative group">
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              data-testid="scheduling-solutions-nav"
            >
              Solutions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[220px]">
                <Link
                  href="/product/voice-ai"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="scheduling-nav-voice-ai"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Voice AI</p>
                    <p className="text-xs text-muted-foreground">AI phone agent</p>
                  </div>
                </Link>
                <Link
                  href="/product/ai-scheduling"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="scheduling-nav-scheduling"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">AI Scheduling</p>
                    <p className="text-xs text-muted-foreground">Auto-book appointments</p>
                  </div>
                </Link>
                <Link
                  href="/product/website-chatbot"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="scheduling-nav-chatbot"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Website AI Chatbot</p>
                    <p className="text-xs text-muted-foreground">Capture leads 24/7</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/book-demo" className="hover:text-foreground transition-colors">Book Demo</Link>
        </div>

        <Button
          onClick={() => (window.location.href = "/login")}
          data-testid="scheduling-header-cta"
          className="v6-page v6-bg-gradient text-white border-0"
        >
          Get Started
        </Button>
      </div>
    </nav>
  );
}

export default function ProductAIScheduling() {
  return (
    <div className="v6-page min-h-screen bg-background text-foreground" data-testid="product-ai-scheduling">
      <SchedulingHeader />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden" data-testid="scheduling-hero">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-full px-4 py-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-medium text-blue-700">AI-Powered Appointment Scheduling</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Fill Your Calendar{" "}
                <span className="v6-text-gradient">on Autopilot</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                Our AI scheduling system qualifies leads, checks your real-time availability, and books appointments automatically — 24/7, zero effort on your end.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {["Free Setup", "Zero Double-Bookings", "Live in 48h", "Money-Back Guarantee"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2"
                    data-testid={`scheduling-guarantee-${item.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="scheduling-hero-cta"
                  className="v6-bg-gradient text-white border-0 v6-shadow-glow text-base px-8"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="scheduling-hero-demo"
                    className="text-base px-8"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book a Demo
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <SchedulingDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30" data-testid="scheduling-stats">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
                data-testid={`scheduling-stat-${i}`}
              >
                <p className="text-3xl lg:text-4xl font-bold v6-text-gradient">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">Based on market research across our client base</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28" data-testid="scheduling-how-it-works" id="how-it-works">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              How It <span className="v6-text-gradient">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Three simple steps to a fully booked calendar — completely hands-free.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-card border border-border rounded-2xl p-8 shadow-sm"
                data-testid={`scheduling-step-${i}`}
              >
                <span className="text-6xl font-bold text-blue-500/5 absolute top-4 right-6 select-none">
                  {item.step}
                </span>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 lg:py-28 bg-muted/30" data-testid="scheduling-value-props">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <p className="text-sm font-semibold tracking-widest uppercase text-blue-600 mb-3">Why Agency</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Zero Risk.{" "}
              <span className="v6-text-gradient">Maximum Bookings.</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {valueProps.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 text-center"
                data-testid={`scheduling-value-${i}`}
              >
                <div className="w-14 h-14 rounded-2xl v6-bg-gradient flex items-center justify-center mx-auto mb-5">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 lg:py-28" data-testid="scheduling-features">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Everything You Need to{" "}
              <span className="v6-text-gradient">Scale Bookings</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
                data-testid={`scheduling-feature-${i}`}
              >
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 bg-muted/30" data-testid="scheduling-testimonials">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <p className="text-sm font-semibold tracking-widest uppercase text-blue-600 mb-3">Trusted By Businesses</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Real Results From Real Clients
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-8 shadow-sm"
                data-testid={`scheduling-testimonial-${i}`}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-foreground text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28" data-testid="scheduling-cta">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative max-w-3xl mx-auto rounded-3xl v6-bg-gradient p-12 lg:p-16 text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                Ready to Fill Your Calendar Automatically?
              </h2>
              <p className="text-white/75 text-lg mb-8 max-w-lg mx-auto">
                Get your AI scheduling system set up and running — completely free to start.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {["Free setup", "Live in 48 hours", "Money-back guarantee", "No credit card"].map((b) => (
                  <div key={b} className="flex items-center gap-2 text-white/85 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-300 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => (window.location.href = "/login")}
                data-testid="scheduling-cta-btn"
                className="text-base px-8 font-semibold"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-xs text-white/50 mt-4">No credit card required • Cancel anytime</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border bg-card">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md v6-bg-gradient flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-sm text-foreground">{BRAND}</span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/product/ai-scheduling" className="hover:text-foreground transition-colors">AI Scheduling</Link>
            <Link href="/product/voice-ai" className="hover:text-foreground transition-colors">Voice AI</Link>
            <Link href="/product/website-chatbot" className="hover:text-foreground transition-colors">Website Chatbot</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
