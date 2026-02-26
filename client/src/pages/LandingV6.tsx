import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Gift,
  Shield,
  RotateCcw,
  PhoneIncoming,
  BrainCircuit,
  CalendarCheck,
  Star,
  Quote,
  Phone,
  ChevronDown,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SchedulingDemo from "@/components/v6/SchedulingDemo";
import VoiceAgentDemo from "@/components/v6/VoiceAgentDemo";
import ChatDemo from "@/components/v6/ChatDemo";

const BRAND = "Agency";

const valueProps = [
  {
    icon: Zap,
    title: "Setup For You",
    description: "We handle everything. From integration to going live—zero work on your end.",
  },
  {
    icon: Gift,
    title: "Setup For Free",
    description: "No upfront costs. We build and launch your AI system at zero cost to start.",
  },
  {
    icon: Shield,
    title: "Try Before You Commit",
    description: "See it in action first. Low-risk trial so you experience the results before committing.",
  },
  {
    icon: RotateCcw,
    title: "No Results? Money Back.",
    description: "If we don't deliver booked appointments, you pay nothing. Simple as that.",
  },
];

const steps = [
  {
    icon: PhoneIncoming,
    step: "01",
    title: "Lead Calls In",
    description: "A potential customer calls your business. Our AI picks up instantly—day or night, no missed calls.",
  },
  {
    icon: BrainCircuit,
    step: "02",
    title: "AI Qualifies & Schedules",
    description: "The AI understands their needs, checks your real-time availability, and books the perfect slot.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "You Show Up & Close",
    description: "You get a notification with all details. The lead gets a confirmation. Everyone wins.",
  },
];

const stats = [
  { value: "500+", label: "Businesses Served" },
  { value: "2.4M", label: "Appointments Booked" },
  { value: "35%", label: "Avg. Revenue Increase" },
  { value: "<3s", label: "Response Time" },
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
    text: "The AI books appointments better than my front desk ever did. Our team can finally focus on the actual work instead of playing phone tag.",
    stars: 5,
  },
  {
    name: "David Chen",
    role: "Owner, Chen & Associates",
    text: "Setup was literally done for me. I didn't touch a thing. Within 48 hours, the AI was answering calls and filling my calendar.",
    stars: 5,
  },
];

function V6Header() {
  const handleGetStarted = () => {
    window.location.href = "/login";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 v6-glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg v6-bg-gradient flex items-center justify-center"
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground">{BRAND}</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <div className="relative group">
            <button className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="v6-solutions-nav">
              Solutions <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[200px]">
                <Link
                  href="/product/voice-ai"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="v6-nav-voice-ai"
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
                  data-testid="v6-nav-scheduling"
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
                  data-testid="v6-nav-chatbot"
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
          <a href="#results" className="hover:text-foreground transition-colors">Results</a>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>

        <Button
          onClick={handleGetStarted}
          data-testid="v6-header-cta"
          className="v6-bg-gradient text-white border-0"
        >
          Get Started
        </Button>
      </div>
    </nav>
  );
}

function V6Footer() {
  return (
    <footer className="border-t border-border bg-card py-10">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg v6-bg-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">{BRAND}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/book-demo" className="hover:text-foreground transition-colors">Book a Demo</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingV6() {
  const handleGetStarted = () => {
    window.location.href = "/login";
  };

  return (
    <div className="v6-page min-h-screen bg-background text-foreground" data-testid="landing-v6">
      <V6Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24" data-testid="v6-hero">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, hsl(210 60% 96%) 0%, transparent 60%)" }}
        />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-700 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse-soft" />
                AI-Powered Lead Capture & Scheduling
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-5 text-foreground"
            >
              Stop Losing Leads.{" "}
              <span className="v6-text-gradient">
                Start Booking Automatically.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              Our AI answers every call, books every appointment, and fills your schedule—24/7.
              No missed calls. No wasted leads. Just growth.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                size="lg"
                onClick={handleGetStarted}
                data-testid="v6-hero-cta"
                className="v6-bg-gradient text-white border-0 text-base px-8 v6-shadow-glow"
              >
                Get Setup For Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Link href="/book-demo">
                <Button size="lg" variant="outline" data-testid="v6-hero-demo">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book a Demo
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <SchedulingDemo />
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 md:py-24 bg-card" data-testid="v6-value-props" id="value-props">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              Zero Risk.{" "}
              <span className="v6-text-gradient">Maximum Results.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              We've removed every barrier so you can focus on what you do best—running your business.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {valueProps.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-background hover:-translate-y-1 transition-transform duration-300"
                data-testid={`v6-value-prop-${i}`}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24" data-testid="v6-how-it-works" id="how-it-works">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              How It{" "}
              <span className="v6-text-gradient">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three simple steps to a fully booked schedule.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
                data-testid={`v6-step-${i}`}
              >
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-border" />
                )}
                <div className="w-20 h-20 mx-auto rounded-2xl v6-bg-gradient-subtle flex items-center justify-center mb-5 relative">
                  <item.icon className="w-8 h-8 text-blue-600" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full v6-bg-gradient text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{item.description}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* Voice AI Section */}
      <section className="py-16 md:py-24 bg-muted/30" data-testid="v6-voice-ai-section">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-full px-4 py-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-medium text-blue-700">AI-Powered Voice Lead Qualification</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                Turn Every Call Into a{" "}
                <span className="v6-text-gradient">Qualified Lead</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                Our AI voice agents pick up instantly, qualify your callers, and book them straight into your calendar — completely hands-free, 24/7.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {["Free Setup", "No Missed Calls", "24/7 Coverage", "Money-Back Guarantee"].map((item) => (
                  <div key={item} className="flex items-center gap-2" data-testid={`v6-voice-guarantee-${item.toLowerCase().replace(/\s+/g, '-')}`}>
                    <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="v6-voice-cta"
                  className="v6-bg-gradient text-white border-0 v6-shadow-glow text-base px-7"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/product/voice-ai">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="v6-voice-learn-more"
                    className="text-base px-7"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Learn More
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <VoiceAgentDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 md:py-24 bg-card" data-testid="v6-social-proof" id="results">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
                data-testid={`v6-stat-${i}`}
              >
                <p className="text-3xl md:text-4xl font-extrabold v6-text-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
              Trusted by Business Owners{" "}
              <span className="v6-text-gradient">Nationwide</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-background border border-border"
                data-testid={`v6-testimonial-${i}`}
              >
                <Quote className="w-8 h-8 text-blue-500/20 mb-3" />
                <p className="text-sm text-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </motion.div>
            ))}
          </div>

          {/* Website AI Chatbot Demo — two-column hero layout */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto mt-8 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="order-2 lg:order-1"
            >
              <ChatDemo />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-7 order-1 lg:order-2"
            >
              <div className="inline-flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-full px-4 py-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-medium text-blue-700">AI-Powered Website Lead Generation</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                Turn Every Visitor Into a{" "}
                <span className="v6-text-gradient">Qualified Lead</span>
              </h3>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                Our AI assistant engages your website visitors 24/7, answers their questions, and captures their details — so you never miss a potential customer again.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {["Free Setup", "No Credit Card", "Live in 48h", "Money-Back Guarantee"].map((item) => (
                  <div key={item} className="flex items-center gap-2" data-testid={`v6-chatbot-guarantee-${item.toLowerCase().replace(/\s+/g, '-')}`}>
                    <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = "/login")}
                  data-testid="v6-chatbot-cta"
                  className="v6-bg-gradient text-white border-0 v6-shadow-glow text-base px-7"
                >
                  Get Setup For Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/product/website-chatbot">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="v6-chatbot-learn-more"
                    className="text-base px-7"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Learn More
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24" data-testid="v6-cta" id="cta">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative max-w-4xl mx-auto rounded-3xl v6-bg-gradient p-10 md:p-16 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(210_100%_60%/0.3),transparent_60%)]" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4">
                Ready to Never Miss a Lead Again?
              </h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
                We'll set everything up for you—for free. If it doesn't deliver results, you don't pay a dime.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleGetStarted}
                  data-testid="v6-cta-primary"
                  className="text-base px-8 font-semibold"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="v6-cta-demo"
                    className="text-base px-8 bg-white/10 border-white/30 text-white"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book a Demo
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>No credit card required • Setup in 48 hours • Cancel anytime</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <V6Footer />
    </div>
  );
}
