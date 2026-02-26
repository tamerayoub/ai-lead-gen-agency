import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Settings,
  DollarSign,
  ShieldCheck,
  MessageSquare,
  Phone,
  Calendar,
  ChevronDown,
  Users,
  BarChart3,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatDemo from "@/components/v6/ChatDemo";

const BRAND = "Agency";

const valueProps = [
  {
    icon: Settings,
    title: "Setup Done For You",
    description: "We handle the entire installation, configuration, and integration — zero technical skills required on your end.",
  },
  {
    icon: Zap,
    title: "Try Before You Commit",
    description: "Not sure yet? Let us set it up and show you the results first. Experience the power before you pay anything.",
  },
  {
    icon: DollarSign,
    title: "Free to Get Started",
    description: "We install the AI assistant on your website at no upfront cost. You only pay when you see real leads coming in.",
  },
  {
    icon: ShieldCheck,
    title: "No Results? Money Back",
    description: "We stand behind our system. If you don't see measurable results, we'll give you a full refund. No questions asked.",
  },
];

const stats = [
  { value: "2,400+", label: "Leads Generated" },
  { value: "150+", label: "Businesses Served" },
  { value: "97%", label: "Client Retention" },
  { value: "4.9/5", label: "Average Rating" },
];

const steps = [
  {
    step: "01",
    icon: Settings,
    title: "We Install It For You",
    desc: "Share your website URL. Our team installs and configures your AI chatbot — trained on your business — at zero cost.",
  },
  {
    step: "02",
    icon: MessageSquare,
    title: "AI Chats & Qualifies",
    desc: "Your AI assistant greets every visitor 24/7, answers questions, and captures their contact details automatically.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "You Close the Deals",
    desc: "Wake up to a full inbox of qualified leads. Track everything in your real-time dashboard and close more business.",
  },
];

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "CEO, BrightSmile Dental",
    text: "Within the first month, we captured 87 new patient leads. The AI assistant works 24/7 and never misses a potential client.",
    stars: 5,
  },
  {
    name: "James Rodriguez",
    role: "Owner, Elite Fitness Gym",
    text: "Setup was completely hands-off. They installed everything and we started seeing results the same week. Incredible ROI.",
    stars: 5,
  },
  {
    name: "Emily Chen",
    role: "Director, Prestige Real Estate",
    text: "The money-back guarantee gave us confidence to try it. Turns out we didn't need it — leads increased by 340% in 60 days.",
    stars: 5,
  },
];

const benefits = [
  "Free setup — no upfront cost",
  "AI trained on your business",
  "Live in under 48 hours",
  "Full money-back guarantee",
];

function ChatbotHeader() {
  return (
    <nav
      className="v6-page fixed top-0 left-0 right-0 z-50 border-b border-border/50 v6-glass"
      data-testid="chatbot-header"
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
            <button className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="chatbot-solutions-nav">
              Solutions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[220px]">
                <Link
                  href="/product/voice-ai"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="chatbot-nav-voice-ai"
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
                  data-testid="chatbot-nav-scheduling"
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
                  data-testid="chatbot-nav-chatbot"
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
          data-testid="chatbot-header-cta"
          className="v6-page v6-bg-gradient text-white border-0"
        >
          Get Started
        </Button>
      </div>
    </nav>
  );
}

export default function ProductWebsiteChatbot() {
  return (
    <div className="v6-page min-h-screen bg-background text-foreground" data-testid="product-website-chatbot">
      <ChatbotHeader />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden" data-testid="chatbot-hero">
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
                <span className="text-xs font-medium text-blue-700">AI-Powered Website Lead Generation</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Turn Every Visitor Into a{" "}
                <span className="v6-text-gradient">Qualified Lead</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                Our AI assistant engages your website visitors 24/7, answers their questions,
                and captures their details — so you never miss a potential customer again.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {["Free Setup", "No Credit Card", "Live in 48h", "Money-Back Guarantee"].map((item) => (
                  <div key={item} className="flex items-center gap-2" data-testid={`chatbot-guarantee-${item.toLowerCase().replace(/\s+/g, '-')}`}>
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="chatbot-hero-cta"
                  className="v6-bg-gradient text-white border-0 v6-shadow-glow text-base px-8"
                >
                  Get Setup For Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="chatbot-hero-demo"
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
              <ChatDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30" data-testid="chatbot-stats">
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
                data-testid={`chatbot-stat-${i}`}
              >
                <p className="text-3xl lg:text-4xl font-bold v6-text-gradient">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 lg:py-28" data-testid="chatbot-value-props">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <p className="text-sm font-semibold tracking-widest uppercase text-blue-600 mb-3">Why Choose Us</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Zero Risk.{" "}
              <span className="v6-text-gradient">Maximum Results.</span>
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
                data-testid={`chatbot-value-${i}`}
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

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-muted/30" data-testid="chatbot-how-it-works" id="how-it-works">
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
              Three simple steps to turn your website into a lead generation machine.
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
                data-testid={`chatbot-step-${i}`}
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

      {/* Social Proof */}
      <section className="py-20 lg:py-28" data-testid="chatbot-testimonials">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <p className="text-sm font-semibold tracking-widest uppercase text-blue-600 mb-3">Trusted By Businesses</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
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
                data-testid={`chatbot-testimonial-${i}`}
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
      <section className="py-20 lg:py-28 bg-muted/30" data-testid="chatbot-cta" id="cta">
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
                Ready to Turn Visitors Into Leads?
              </h2>
              <p className="text-white/75 text-lg mb-8 max-w-lg mx-auto">
                Get your AI-powered lead generation assistant set up on your website — completely free.
              </p>

              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {benefits.map((b) => (
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
                data-testid="chatbot-cta-btn"
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
            <Link href="/product/website-chatbot" className="hover:text-foreground transition-colors">Website Chatbot</Link>
            <Link href="/product/voice-ai" className="hover:text-foreground transition-colors">Voice AI</Link>
            <Link href="/product/ai-scheduling" className="hover:text-foreground transition-colors">AI Scheduling</Link>
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
