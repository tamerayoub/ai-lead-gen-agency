import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Phone,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle2,
  Star,
  ArrowRight,
  Users,
  BarChart3,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceAgentDemo from "@/components/v6/VoiceAgentDemo";

const BRAND = "Agency";

const guarantees = [
  { icon: Zap, text: "Setup Done For You" },
  { icon: Phone, text: "24/7 AI Calling" },
  { icon: Shield, text: "Free to Get Started" },
  { icon: TrendingUp, text: "No Results? Money Back" },
];

const stats = [
  { value: "2,400+", label: "Leads Qualified" },
  { value: "340%", label: "Avg ROI Increase" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "50+", label: "Businesses Served" },
];

const testimonials = [
  {
    name: "James Carter",
    role: "CEO, TechFlow",
    text: "We saw a 400% increase in qualified leads within the first month. The AI voice agent handles calls so naturally our prospects can't tell the difference.",
    rating: 5,
  },
  {
    name: "Sarah Mitchell",
    role: "Founder, GrowthLab",
    text: "Setup was done completely for us — we didn't lift a finger. Now our pipeline is overflowing with high-quality leads on autopilot.",
    rating: 5,
  },
  {
    name: "David Park",
    role: "VP Sales, ScaleUp",
    text: "The money-back guarantee gave us confidence to try it. Three months in and we've 5x'd our outbound conversions.",
    rating: 5,
  },
];

const steps = [
  {
    step: "01",
    icon: Users,
    title: "We Set It Up For You",
    desc: "Share your ideal customer profile. Our team builds your custom AI voice agent, scripts, and targeting — at no cost.",
  },
  {
    step: "02",
    icon: Phone,
    title: "AI Calls & Qualifies",
    desc: "Your AI agent makes natural-sounding calls 24/7, qualifying leads and booking meetings directly on your calendar.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "You Close Deals",
    desc: "Show up to pre-qualified meetings ready to close. Track everything in your real-time dashboard.",
  },
];

function VoiceAIHeader() {
  return (
    <nav
      className="v6-page fixed top-0 left-0 right-0 z-50 border-b border-border/50 v6-glass"
      data-testid="voice-ai-header"
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
            <button className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="solutions-nav">
              Solutions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[200px]">
                <Link
                  href="/product/voice-ai"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="nav-voice-ai"
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
                  href="/v6"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="nav-scheduling"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">AI Scheduling</p>
                    <p className="text-xs text-muted-foreground">Auto-book appointments</p>
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
          data-testid="voice-ai-header-cta"
          className="v6-page v6-bg-gradient text-white border-0"
        >
          Get Started
        </Button>
      </div>
    </nav>
  );
}

export default function ProductVoiceAI() {
  return (
    <div className="v6-page min-h-screen bg-background text-foreground" data-testid="product-voice-ai">
      <VoiceAIHeader />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24" data-testid="voice-ai-hero">
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
                <span className="text-xs font-medium text-blue-700">AI-Powered Voice Lead Qualification</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Turn Every Call Into a{" "}
                <span className="v6-text-gradient">Qualified Lead</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                Our AI voice agents call, qualify, and book meetings with your ideal
                prospects — completely done for you with zero effort on your end.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {guarantees.map((g) => (
                  <div key={g.text} className="flex items-center gap-2" data-testid={`voice-ai-guarantee-${g.text.toLowerCase().replace(/\s+/g, '-')}`}>
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{g.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="voice-ai-hero-cta"
                  className="v6-bg-gradient text-white border-0 v6-shadow-glow text-base px-8"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="voice-ai-hero-demo"
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
              <VoiceAgentDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30" data-testid="voice-ai-stats">
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
                data-testid={`voice-ai-stat-${i}`}
              >
                <p className="text-3xl lg:text-4xl font-bold v6-text-gradient">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28" data-testid="voice-ai-how-it-works" id="how-it-works">
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
              Three simple steps to flood your pipeline with qualified leads.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-card border border-border rounded-2xl p-8 shadow-sm"
                data-testid={`voice-ai-step-${i}`}
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

          {/* Voice Agent Demo under How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <VoiceAgentDemo />
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 bg-muted/30" data-testid="voice-ai-testimonials">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Trusted by Growing Businesses
            </h2>
            <p className="text-muted-foreground text-lg">
              Join 50+ companies already scaling their outbound with AI.
            </p>
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
                data-testid={`voice-ai-testimonial-${i}`}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
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
      <section className="py-20 lg:py-28" data-testid="voice-ai-cta" id="cta">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl v6-bg-gradient p-12 lg:p-20 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(210_100%_70%/0.3),transparent_60%)]" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Ready to 10x Your Qualified Leads?
              </h2>
              <p className="text-white/75 text-lg mb-8 max-w-lg mx-auto">
                Get your AI voice agent set up for free. No technical skills needed —
                we handle everything. No results? Full money back.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="voice-ai-cta-btn"
                  className="text-base px-8 font-semibold"
                >
                  Start For Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {["Setup Done For You", "100% Free Trial", "Money-Back Guarantee"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-white/70" />
                    <span className="text-sm text-white/70">{item}</span>
                  </div>
                ))}
              </div>
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
            <Link href="/product/voice-ai" className="hover:text-foreground transition-colors">Voice AI</Link>
            <Link href="/v6" className="hover:text-foreground transition-colors">AI Scheduling</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/book-demo" className="hover:text-foreground transition-colors">Book Demo</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
