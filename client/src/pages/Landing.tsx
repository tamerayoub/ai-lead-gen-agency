import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Calendar,
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  FileText,
  Mail,
  Zap,
  Target,
  DollarSign,
  Home,
  Shield,
  Bot,
  Headphones,
  Brain,
} from "lucide-react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { useEffect, useRef } from "react";
import buildingImage from "@assets/ChatGPT Image Nov 8, 2025, 08_21_25 AM_1762611819440.png";
import houseImage from "@assets/ChatGPT Image Nov 8, 2025, 08_25_55 AM_1762621348556.png";
import aiAgentImage from "@assets/b7c58cd8-092c-4292-be66-5010614b1f84_1762621963270.png";
import leasingAgentImage from "@assets/2458e809-2baf-4e6a-bc24-a8d00394c58f_1762709030771.png";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// Animated Counter Component
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionValue = useMotionValue(0);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const controls = animate(motionValue, value, {
        duration: 2,
        ease: "easeOut",
      });
      return controls.stop;
    }
  }, [isInView, motionValue, value]);

  const rounded = useTransform(motionValue, (latest) => {
    if (suffix === "x") {
      // Show whole numbers for integer values, one decimal for non-integers
      const formatted =
        latest % 1 === 0 ? Math.round(latest) : latest.toFixed(1);
      return `${formatted}${suffix}`;
    }
    return `${Math.round(latest)}${suffix}`;
  });

  return (
    <motion.div ref={ref} className="text-3xl font-bold text-primary mb-1">
      {rounded}
    </motion.div>
  );
}

export default function Landing() {
  const handleGetStarted = () => {
    window.location.href = "/onboarding";
  };

  const handleSignIn = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200/50 sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">Lead2Lease</span>
          </div>
          <Button onClick={handleSignIn} data-testid="button-signin-header">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section - Benefits Focused */}
      <section className="container mx-auto px-4 py-20 lg:py-32 relative">
        {/* Animated gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        {/* Single-family house image - Left side */}
        <motion.div
          className="absolute -left-[260px] top-18 w-1/3 max-w-lg opacity-25 pointer-events-none hidden lg:block"
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 0.7, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <img
            src={houseImage}
            alt="Single-family house"
            className="w-full h-auto drop-shadow-lg"
          />
        </motion.div>

        {/* Multi-family building image - Right side */}
        <motion.div
          className="absolute -right-[260px] top-18 w-1/3 max-w-lg opacity-25 pointer-events-none hidden lg:block"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 0.7, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <img
            src={buildingImage}
            alt="Multi-family residential buildings"
            className="w-full h-auto drop-shadow-lg"
          />
        </motion.div>

        <motion.div
          className="max-w-5xl mx-auto text-center relative z-10"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1
            variants={fadeInUp}
            className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
          >
            More Leads. More Showings.
            <br />
            More Leases. Lower Vacancy.
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto"
          >
            Lead2Lease is the AI-powered leasing platform that automates your
            entire rental pipeline—from first inquiry to signed lease—so you can
            fill vacancies faster and maximize revenue.
          </motion.p>
          <div className="flex gap-4 flex-wrap justify-center mb-12">
            <Button
              size="lg"
              onClick={handleGetStarted}
              data-testid="button-get-started-hero"
              className="text-lg px-8 py-6"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Link href="/book-demo">
              <Button
                size="lg"
                variant="secondary"
                data-testid="button-book-demo-hero"
                className="text-lg px-8 py-6 border-2"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Schedule a Demo
              </Button>
            </Link>
          </div>

          {/* Key Metrics */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            variants={staggerContainer}
          >
            <motion.div
              variants={scaleIn}
              className="text-center"
              data-testid="metric-qualified-leads"
            >
              <Counter value={3} suffix="x" />
              <div className="text-sm text-gray-600">More Qualified Leads</div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              className="text-center"
              data-testid="metric-response-time"
            >
              <Counter value={50} suffix="%" />
              <div className="text-sm text-gray-600">Faster Response Time</div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              className="text-center"
              data-testid="metric-showings"
            >
              <Counter value={2} suffix="x" />
              <div className="text-sm text-gray-600">More Showings Booked</div>
            </motion.div>
            <motion.div
              variants={scaleIn}
              className="text-center"
              data-testid="metric-vacancy-costs"
            >
              <Counter value={40} suffix="%" />
              <div className="text-sm text-gray-600">Lower Vacancy Costs</div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* AI Leasing Agent - The Star Feature */}
      <section className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20 relative">
            {/* AI Agent Image - Right Side */}
            <motion.div
              className="absolute right-0 top-[33%] -translate-y-1/3 w-[750px] pointer-events-none hidden xl:block z-0"
              initial={{ opacity: 0, x: 100 }}
              whileInView={{ opacity: 0.75, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ right: '-650px' }}
            >
              <img
                src={aiAgentImage}
                alt="AI Leasing Agent"
                className="w-full h-auto drop-shadow-2xl"
              />
            </motion.div>

            <motion.div
              className="text-center mb-12 relative z-20"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <Bot className="h-4 w-4 animate-pulse-soft" />
                <span className="text-sm font-semibold">
                  AI-Powered Automation
                </span>
              </div>
              <h2 className="text-4xl font-bold mb-4">
                Your 24/7 AI Leasing Agent
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Never miss a lead again. Our AI Leasing Agent works around the
                clock to engage prospects, answer questions, pre-screen
                applicants, and book showings—automatically. It works just like
                a real leasing agent, learning from every conversation to get
                smarter over time.
              </p>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-2 gap-6 mb-8 relative z-20"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.div variants={scaleIn}>
                <Card
                  data-testid="card-email-campaigns"
                  className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
                >
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Intelligent Email Campaigns</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Gmail integration for seamless inbox management
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Trigger-based automation (no response → instant
                        follow-up)
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        AI-driven optimal timing for maximum engagement
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Auto-Pilot or Co-Pilot mode—you choose the level of
                        control
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={scaleIn}>
                <Card
                  data-testid="card-pre-screening"
                  className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
                >
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Smart Pre-Screening</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Ask qualifying questions (income, move-in date,
                        evictions)
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Train your AI with custom screening criteria
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Ingests your property data and qualification
                        requirements
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-white">
                        Escalates to you when needed with full context
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* AI Learning Callout */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="relative z-20"
            >
              <Card
                className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
                data-testid="card-ai-learning"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        AI That Gets Smarter Over Time
                      </h3>
                      <p className="text-white">
                        Our AI doesn't just automate—it learns. With every
                        conversation, it adapts to your communication style,
                        understands your properties better, and becomes more
                        effective at converting leads. It's like having a
                        leasing agent who improves with every interaction,
                        without the learning curve.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lead Conversion */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
              >
                <h2 className="text-4xl font-bold mb-4">Convert Every Lead</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Lead2Lease follows up with every prospect automatically,
                  sending the right message based on their unique situation,
                  property preferences, and stage in the rental journey.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Instant Response</div>
                      <p className="text-sm text-gray-600">
                        Reply to inquiries within seconds, 24/7—even while you
                        sleep
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">
                        Personalized Outreach
                      </div>
                      <p className="text-sm text-gray-600">
                        AI crafts contextual messages based on property details
                        and lead history
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">
                        Persistent Follow-Up
                      </div>
                      <p className="text-sm text-gray-600">
                        Never let a lead go cold—automated nurture sequences
                        keep them engaged
                      </p>
                    </div>
                  </li>
                </ul>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
              <Card className="p-8 border-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="text-sm text-white">
                      New inquiry received
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-6">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-white">
                      AI responds in 30 seconds
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="text-sm text-white">
                      No response after 24 hours
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-6">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-white">
                      AI sends personalized follow-up
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="text-sm text-white">
                      Lead shows interest
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-6">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-white">
                      AI books showing automatically
                    </span>
                  </div>
                </div>
              </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Scheduling */}
      <section className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20 relative">
            {/* Leasing Agent Image - Left Side */}
            <motion.div
              className="absolute left-0 top-[12%] -translate-y-1/3 w-[750px] pointer-events-none hidden xl:block z-0"
              initial={{ opacity: 0, x: -100 }}
              whileInView={{ opacity: 0.85, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ left: '-735px' }}
            >
              <img
                src={leasingAgentImage}
                alt="Leasing agent showing property"
                className="w-full h-auto drop-shadow-2xl"
                data-testid="img-leasing-agent"
              />
            </motion.div>

            <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
              >
              <Card className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">In-Person Showings</h3>
                <p className="text-white mb-4">
                  Smart Scheduling automatically fills your team's calendar
                  based on optimal availability, route efficiency, and property
                  clustering. No more back-and-forth scheduling emails.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Calendar sync with availability detection</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Route optimization for efficient showing tours</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Property clustering to minimize drive time</span>
                  </li>
                </ul>
              </Card>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
              <Card className="p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  Self-Guided Showings
                </h3>
                <p className="text-white mb-4">
                  Offer secure, contactless showings that prospects can book
                  instantly. Integration with SentriLock, Codex, Igloo, and
                  smart locks makes it effortless.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>One-time access codes generated automatically</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Prospect identity verification before access</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Automated showing confirmations and reminders</span>
                  </li>
                </ul>
              </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Application Management */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div 
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4">
                AI-Powered Application Processing
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                From showing to approved application in record time. Our AI
                handles the entire application workflow while you maintain full
                control.
              </p>
            </motion.div>

            <motion.div 
              className="grid md:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.div variants={scaleIn}>
              <Card>
                <CardHeader>
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Instant Application Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white">
                    AI automatically sends customized applications to qualified
                    prospects right after showings. Pre-filled with property
                    details and requirements.
                  </p>
                </CardContent>
              </Card>
              </motion.div>

              <motion.div variants={scaleIn}>
              <Card>
                <CardHeader>
                  <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Automated Screening</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white">
                    AI reviews applications for completeness, flags missing
                    information, and validates against your screening criteria
                    automatically.
                  </p>
                </CardContent>
              </Card>
              </motion.div>

              <motion.div variants={scaleIn}>
              <Card>
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Smart Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white">
                    Get AI-powered applicant rankings based on income
                    verification, rental history, and custom scoring rules you
                    define.
                  </p>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Lease Drafting */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
              >
                <h2 className="text-4xl font-bold mb-4">AI Lease Drafting</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Generate state-compliant, customized lease agreements in
                  minutes. Our AI understands tenant-landlord laws and
                  automatically incorporates your property-specific terms.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">
                        Upload Your Templates
                      </div>
                      <p className="text-sm text-gray-600">
                        AI learns from your existing leases to match your
                        preferred language and clauses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">
                        State-Specific Compliance
                      </div>
                      <p className="text-sm text-gray-600">
                        Choose from state-specific templates or let AI customize
                        based on local laws
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">
                        Co-Pilot or Auto-Pilot
                      </div>
                      <p className="text-sm text-gray-600">
                        Review and approve drafts, or let AI generate and send
                        fully automated
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="font-semibold text-white">
                      Lease Drafting Process
                    </span>
                    <span className="text-xs text-white">~3 minutes</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        1
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          AI reviews conversation & application
                        </div>
                        <div className="text-xs text-white">
                          Extracts tenant details, move-in dates, special
                          requests
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        2
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          Generates state-compliant draft
                        </div>
                        <div className="text-xs text-white">
                          Incorporates property terms and legal requirements
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        3
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          You review and approve
                        </div>
                        <div className="text-xs text-white">
                          Or enable Auto-Pilot for instant delivery
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Reporting & Analytics */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div 
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4">Reporting Made Easy</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Beautiful owner reports with customizable showing feedback and
                detailed metrics on every aspect of your leasing operation.
                Plus, chat with your data using Intelligence AI.
              </p>
            </motion.div>

            <motion.div 
              className="grid md:grid-cols-2 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.div variants={scaleIn}>
              <Card>
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-3" />
                  <CardTitle className="text-2xl">Owner Reports</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-white mb-4">
                    Generate professional reports for property owners with
                    customizable showing feedback, applicant summaries, and
                    leasing progress.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Branded PDF reports with your logo and styling
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Showing feedback and prospect comments</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Automated delivery on your schedule</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              </motion.div>

              <motion.div variants={scaleIn}>
              <Card>
                <CardHeader>
                  <DollarSign className="h-10 w-10 text-primary mb-3" />
                  <CardTitle className="text-2xl">
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-white mb-4">
                    Track every metric that matters: conversion rates,
                    time-to-lease, vacancy costs, lead sources, and ROI per
                    property.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Real-time dashboards and trend analysis</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>AI-powered insights and recommendations</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Chat with your data using natural language</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Scalability Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">
                Built for Any Portfolio Size
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Whether you manage 5 units or 500+, Lead2Lease delivers ROI from
                day one.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card data-testid="card-small-portfolio">
                <CardHeader>
                  <Home className="h-10 w-10 text-primary mb-3" />
                  <CardTitle className="text-2xl">Small Portfolios</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white mb-4">
                    Managing a handful of properties? Lead2Lease helps you
                    compete with larger operators by automating tasks that would
                    otherwise eat up your time.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Respond instantly to every inquiry, even with limited
                        staff
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Fill vacancies faster with automated follow-ups
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Professional leasing experience without the overhead
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card data-testid="card-large-portfolio">
                <CardHeader>
                  <Building2 className="h-10 w-10 text-primary mb-3" />
                  <CardTitle className="text-2xl">
                    Large Portfolios (100+ Units)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white mb-4">
                    Managing hundreds of units? Lead2Lease scales effortlessly
                    to handle high-volume operations while maintaining quality
                    at every touchpoint.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Handle thousands of leads without adding headcount
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>
                        Consistent messaging across your entire portfolio
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>ROI that compounds as your portfolio grows</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg font-semibold text-primary">
                No matter your portfolio size, Lead2Lease guarantees positive
                ROI within 90 days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 24/7 Support Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scaleIn}
            >
            <Card
              className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20"
              data-testid="card-support"
            >
              <CardContent className="p-12">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Headphones className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">
                    We're Here for You, 24/7
                  </h2>
                  <p className="text-lg text-white mb-6 max-w-2xl mx-auto">
                    Our dedicated support team is available around the clock to
                    help you get the most out of Lead2Lease. Whether you need
                    technical assistance, training, or strategic advice—we're
                    just a message away.
                  </p>
                  <div className="flex items-center justify-center gap-8 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">
                        24/7 Live Support
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">
                        Onboarding Assistance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">
                        Strategy Consulting
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-t border-gray-200 mb-20"></div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
          >
          <Card className="max-w-4xl mx-auto p-12 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="text-center">
              <h2 className="text-4xl font-bold mb-4">
                Ready to Fill Your Vacancies Faster?
              </h2>
              <p className="text-lg text-white mb-8 max-w-2xl mx-auto">
                Join property managers who are using Lead2Lease to generate more
                leads, book more showings, and close more leases—all while
                reducing vacancy costs by 40%.
              </p>
              <div className="flex gap-4 flex-wrap justify-center mb-8">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  data-testid="button-get-started-cta"
                  className="text-lg px-8 py-6"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Free Trial
                </Button>
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="button-book-demo-cta"
                    className="text-lg px-8 py-6 bg-white border-2 border-primary text-primary hover:bg-primary hover:text-gray-600"
                  >
                    Schedule a Demo
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-white">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </div>
          </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Tagline */}
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-white mb-2">
                Faster leasing starts here.
              </h3>
            </div>

            {/* Footer Navigation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Platform */}
              <div>
                <h4 className="font-semibold text-white mb-4">Platform</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/login"
                      className="text-white hover:text-gray-600 transition-colors"
                    >
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/onboarding"
                      className="text-white hover:text-gray-600 transition-colors"
                    >
                      Get Started
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="font-semibold text-white mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/book-demo"
                      className="text-white hover:text-gray-600 transition-colors"
                    >
                      Book Demo
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Help */}
              <div>
                <h4 className="font-semibold text-white mb-4">Help</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a
                      href="mailto:lead2leaseai@gmail.com"
                      className="text-white hover:text-gray-600 transition-colors"
                    >
                      Support
                    </a>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-semibold text-white mb-4">Contact Info</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <a
                      href="mailto:lead2leaseai@gmail.com"
                      className="text-white hover:text-gray-600 transition-colors"
                    >
                      lead2leaseai@gmail.com
                    </a>
                  </p>
                  <p className="text-white">HQ: Minneapolis, Minnesota</p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800 pt-8 text-center text-sm">
              <p className="text-gray-400">
                Lead2Lease is an AI-powered leasing technology platform. |
                Copyright © 2025 Lead2Lease. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
