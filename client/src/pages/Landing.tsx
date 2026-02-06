import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
// Dialog components for demo popup
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PublicHeader } from "@/components/PublicHeader";
import {
  Building2,
  Calendar,
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
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
  Crown,
  Rocket,
  Star,
  Lock,
  Phone,
  ArrowRight,
  Plug,
  Link2,
  Cloud,
  Database,
  FileCheck,
} from "lucide-react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

function LandingContent() {
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);

  // Fetch launch date from database
  const { data: launchDateData } = useQuery<{ launchDate: string }>({
    queryKey: ["/api/launch-date"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch founding partner price from Stripe
  const { data: priceData } = useQuery<{
    productId: string | null;
    priceId: string | null;
    amount: number;
    currency: string;
    interval: string;
    formattedAmount: string;
  }>({
    queryKey: ["/api/stripe/founding-partner-price"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
  
  const displayPrice = priceData?.formattedAmount || "1999.99";
  const enterpriseSectionPrice = "1999.99"; // Hardcoded price for Enterprise section

  const launchDate = useMemo(() => {
    if (launchDateData?.launchDate) {
      return new Date(launchDateData.launchDate).getTime();
    }
    // Fallback to 1 month from now if not loaded yet
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
  }, [launchDateData]);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const difference = launchDate - now;

      if (difference > 0) {
        setTimeRemaining({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [launchDate]);

  // Show demo dialog after 1 minute (regardless of user activity)
  useEffect(() => {
    // Show dialog after exactly 1 minute, even if user is actively scrolling/clicking
    const timer = setTimeout(() => {
      // Check if user hasn't already seen the dialog (using sessionStorage)
      const hasSeenDialog = sessionStorage.getItem("demo-dialog-shown");
      if (!hasSeenDialog) {
        setShowDemoDialog(true);
        sessionStorage.setItem("demo-dialog-shown", "true");
      }
    }, 60000); // 1 minute = 60000ms

    return () => clearTimeout(timer);
  }, []);

  // Prevent swipe-to-navigate gestures
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartX || !touchStartY) return;
      
      const touchEndX = e.touches[0].clientX;
      const touchEndY = e.touches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      
      // Prevent horizontal swipe navigation if it's a significant horizontal swipe
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);


  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!demoEmail || !demoEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingDemo(true);
    
    try {
      // Submit demo request with email and required defaults
      // The schema requires firstName, lastName, phone, etc., so we provide defaults
      await apiRequest("POST", "/api/demo-requests", {
        email: demoEmail,
        firstName: "Not", // Default value since field is required
        lastName: "Provided", // Default value since field is required
        phone: "0000000000", // Default value since field is required
        countryCode: "+1",
        company: null, // Optional field
        unitsUnderManagement: "Not specified", // Default value since field is required
        managedOrOwned: "Not specified", // Default value since field is required
        hqLocation: "Not specified", // Default value since field is required
        currentTools: null, // Optional field
        agreeTerms: true,
        agreeMarketing: false,
        isCurrentCustomer: false,
      });
      
      toast({
        title: "Demo request submitted!",
        description: "We'll be in touch soon to schedule your demo.",
      });
      
      setShowDemoDialog(false);
      setDemoEmail("");
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit demo request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const handleGetStarted = () => {
    window.location.href = "/onboarding";
  };

  const [, setLocation] = useLocation();

  const handleSignIn = () => {
    // Redirect to app subdomain login in production, or /login locally
    const hostname = window.location.hostname.toLowerCase();
    const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
    
    if (isProductionMarketing) {
      window.location.href = 'https://app.lead2lease.ai/login';
    } else {
      setLocation("/login");
    }
  };

  const handleScrollToMembership = () => {
    const membershipSection = document.querySelector('[data-testid="section-founding-partner"]');
    if (membershipSection) {
      membershipSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBecomeFoundingPartner = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    // Redirect to app subdomain register in production
    const hostname = window.location.hostname.toLowerCase();
    const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
    const returnTo = encodeURIComponent("/founding-partner-checkout");
    
    if (isProductionMarketing) {
      window.location.href = `https://app.lead2lease.ai/register?returnTo=${returnTo}`;
    } else {
      setLocation(`/register?returnTo=${returnTo}`);
    }
  };

  const handleSeeItInAction = () => {
    // Redirect to app subdomain register in production
    const hostname = window.location.hostname.toLowerCase();
    const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
    const returnTo = encodeURIComponent("/founding-partner-checkout");
    
    if (isProductionMarketing) {
      window.location.href = `https://app.lead2lease.ai/register?returnTo=${returnTo}`;
    } else {
      setLocation(`/register?returnTo=${returnTo}`);
    }
  };

  const scrollToSection = (sectionId: string) => {
    // Prevent any immediate scroll interference
    const scrollToTarget = () => {
      const element = document.getElementById(sectionId);
      if (!element) return;
      
      const offset = 100; // Offset for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      // Use window.scrollTo for reliable behavior
      window.scrollTo({
        top: Math.max(0, offsetPosition), // Ensure we don't scroll to negative position
        behavior: 'smooth'
      });
    };
    
    // Delay to allow dropdown to close and layout to stabilize
    setTimeout(() => {
      // Use multiple requestAnimationFrame calls to ensure layout is fully stable
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToTarget();
        });
      });
    }, 300); // Increased delay to ensure dropdown is fully closed
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 relative overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Background gradient spots for glassmorphism effect - neutral night colors */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-slate-300/15 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gray-400/12 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-300/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-neutral-300/12 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-stone-300/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-slate-400/8 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        
        {/* Blue property outlines - Single-family */}
        <svg className="absolute inset-0 w-full h-full opacity-30" style={{ zIndex: 0 }}>
          {/* Single-family property 1 - Center left */}
          <g transform="translate(20%, 5%)">
            <polygon points="40,80 0,60 0,100 40,120 80,100 80,60" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="10" y="80" width="60" height="40" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="20" y="90" width="15" height="20" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="45" y="90" width="15" height="20" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="30" y="100" width="20" height="20" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
          </g>
          
          {/* Single-family property 2 - Center right */}
          <g transform="translate(60%, 8%)">
            <polygon points="50,90 0,70 0,110 50,130 100,110 100,70" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="15" y="90" width="70" height="40" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="25" y="100" width="18" height="22" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="55" y="100" width="18" height="22" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="35" y="110" width="25" height="20" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
          </g>
          
          {/* Single-family property 3 - Bottom right */}
          <g transform="translate(70%, 75%)">
            <polygon points="35,70 0,55 0,85 35,100 70,85 70,55" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="8" y="70" width="54" height="30" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <rect x="15" y="78" width="12" height="15" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="35" y="78" width="12" height="15" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="22" y="85" width="18" height="15" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
          </g>
        </svg>
      </div>
      
      {/* Header - Shared Component */}
      <PublicHeader 
        onGetEarlyAccess={handleBecomeFoundingPartner}
        scrollToSection={scrollToSection}
        currentPage="landing"
      />

      {/* Hero Section - Benefits Focused */}
      <section className="relative overflow-hidden pt-20 md:pt-24">
        {/* Background layer that will be blurred under the header */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-8 w-72 h-72 bg-blue-600/8 md:bg-blue-600/15 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
          <div className="absolute top-0 -right-8 w-72 h-72 bg-sky-400/10 md:bg-sky-400/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-10 left-20 w-72 h-72 bg-pink-300/10 md:bg-pink-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 md:bg-primary/10 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-1000"></div>
        </div>

        {/* Foreground content must be above the background */}
        <div className="relative z-10 container mx-auto px-4 md:px-6 pt-8 pb-12 lg:pt-12 lg:pb-16 max-w-full overflow-x-hidden">
          <motion.div
            className="max-w-5xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
          {/* AI-Powered Residential Leasing Platform Banner */}
          <motion.div
            variants={fadeInUp}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <span className="text-sm font-semibold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">AI-Powered Residential Leasing Platform</span>
          </motion.div>
          
          <motion.h1
            variants={fadeInUp}
            className="text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent"
          >
            <span className="block md:inline">More Leads.</span>{" "}
            <span className="block md:inline">More Showings.</span>{" "}
            <span className="block md:inline">More Leases.</span>{" "}
            <span className="block md:inline">Lower Vacancy.</span>
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-lg lg:text-xl text-gray-600 mb-6 max-w-3xl mx-auto"
          >
            Lead2Lease is the AI-powered residential leasing platform that automates your
            entire property rental pipeline—from first inquiry to signed lease—so you can
            fill property vacancies faster and maximize revenue.
          </motion.p>
          <div className="flex gap-4 flex-wrap justify-center mb-8">
            <Button
              size="lg"
              onClick={handleBecomeFoundingPartner}
              data-testid="button-get-started-hero"
              className="px-6 py-4 text-white hover:opacity-90 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
              style={{ backgroundColor: '#FFDF00' }}
            >
              <Crown className="mr-2 h-4 w-4 flex-shrink-0" />
              <div className="flex flex-col items-center text-center">
                <span className="text-base font-semibold leading-tight">Get Early Premium Access</span>
                <span className="text-xs font-normal opacity-90 leading-tight">Become a Founding Partner</span>
              </div>
            </Button>
            <Link href="/book-demo">
              <Button
                size="lg"
                variant="outline"
                data-testid="button-book-demo-hero"
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-base px-6 py-4 border-2 border-blue-600 rounded-xl transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule a Demo
              </Button>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="relative max-w-6xl mx-auto mb-8">
            {/* Desktop view - grid layout */}
            <div className="hidden md:flex flex-nowrap justify-center gap-4">
              <motion.div
                variants={scaleIn}
                className="text-center p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex-1 max-w-[180px]"
                data-testid="metric-lead-to-tour"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <Counter value={42} suffix="%" />
                <div className="text-sm text-gray-600">Lead to Tour Rate</div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                className="text-center p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex-1 max-w-[180px]"
                data-testid="metric-time-saved"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <Counter value={70} suffix="%" />
                <div className="text-sm text-gray-600">Time Saved</div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                className="text-center p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex-1 max-w-[180px]"
                data-testid="metric-appointments"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <Counter value={113} suffix="%" />
                <div className="text-sm text-gray-600">Increase in Appointments</div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                className="text-center p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex-1 max-w-[180px]"
                data-testid="metric-days-on-market"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <Counter value={9} suffix="" />
                <div className="text-sm text-gray-600">Fewer Days on Market</div>
              </motion.div>
              <motion.div
                variants={scaleIn}
                className="text-center p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex-1 max-w-[180px]"
                data-testid="metric-lead-2-lease"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <Counter value={40} suffix="%" />
                <div className="text-sm text-gray-600">More Lead-2-Leases</div>
              </motion.div>
            </div>

            {/* Mobile view - marquee animation */}
            <div className="md:hidden relative overflow-hidden py-4">
              {/* Gradient overlays for fade effect */}
              <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
              
              <div className="flex animate-marquee gap-4" style={{ width: 'max-content' }}>
                {/* First set of KPIs */}
                {[
                  { value: 42, suffix: "%", label: "Lead to Tour Rate", icon: Target },
                  { value: 70, suffix: "%", label: "Time Saved", icon: Clock },
                  { value: 113, suffix: "%", label: "Increase in Appointments", icon: Calendar },
                  { value: 9, suffix: "", label: "Fewer Days on Market", icon: TrendingDown },
                  { value: 40, suffix: "%", label: "More Lead-2-Leases", icon: TrendingUp },
                ].map((metric, idx) => (
                  <div key={`kpi-1-${idx}`} className="flex-shrink-0">
                    <div className="text-center p-3 rounded-xl bg-white border border-gray-200 shadow-sm w-[140px]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                          <metric.icon className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <Counter value={metric.value} suffix={metric.suffix} />
                      <div className="text-sm text-gray-600">{metric.label}</div>
                    </div>
                  </div>
                ))}
                
                {/* Duplicate set for seamless loop */}
                {[
                  { value: 42, suffix: "%", label: "Lead to Tour Rate", icon: Target },
                  { value: 70, suffix: "%", label: "Time Saved", icon: Clock },
                  { value: 113, suffix: "%", label: "Increase in Appointments", icon: Calendar },
                  { value: 9, suffix: "", label: "Fewer Days on Market", icon: TrendingDown },
                  { value: 40, suffix: "%", label: "More Lead-2-Leases", icon: TrendingUp },
                ].map((metric, idx) => (
                  <div key={`kpi-2-${idx}`} className="flex-shrink-0">
                    <div className="text-center p-3 rounded-xl bg-white border border-gray-200 shadow-sm w-[140px]">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                          <metric.icon className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <Counter value={metric.value} suffix={metric.suffix} />
                      <div className="text-sm text-gray-600">{metric.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <motion.p
            variants={fadeInUp}
            className="text-xs text-gray-400 text-center mb-8"
          >
            KPIs are based on market research
          </motion.p>

          {/* Product Pipeline */}
          <motion.div
            variants={fadeInUp}
            className="mb-12"
          >
            <div className="max-w-6xl mx-auto px-4 overflow-x-hidden">
              <h3 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Your Complete AI-Powered Leasing Pipeline
              </h3>
              
              {/* Desktop view - Pipeline Flow with arrows */}
              <div className="hidden md:flex items-center justify-between gap-0 relative pb-4">
                  {[
                    { title: "AI-Leasing Agent", description: "Automatically follows up with every lead, answering questions and engaging prospects 24/7", icon: Bot, onClick: () => scrollToSection('ai-leasing-agent') },
                    { title: "AI Pre-Qualify", description: "AI screens prospects with customizable questions to identify serious applicants", icon: CheckCircle2, onClick: () => scrollToSection('smart-pre-screening') },
                    { title: "AI-Smart Scheduling", description: "Automatically books showings based on optimal availability and route efficiency", icon: Calendar, onClick: () => scrollToSection('ai-smart-scheduling') },
                    { title: "AI Application Processing", description: "Streamlines the entire application workflow from submission to approval", icon: FileText, onClick: () => scrollToSection('ai-application-processing') },
                    { title: "AI Leasing", description: "Generates state-compliant, customized lease agreements in minutes", icon: Shield, onClick: () => scrollToSection('ai-lease-drafting') },
                  ].flatMap((step, idx) => {
                    // Calculate gradient opacity - starts at 0.35 and decreases to 0.05 (more noticeable)
                    const bgOpacity = 0.35 - (idx * 0.075); // 0.35, 0.275, 0.2, 0.125, 0.05
                    const borderOpacity = 0.7 - (idx * 0.15); // 0.7, 0.55, 0.4, 0.25, 0.1
                    const iconOpacity = 1 - (idx * 0.15); // 1, 0.85, 0.7, 0.55, 0.4
                    
                    const elements = [
                  <motion.div
                        key={`desktop-pipeline-card-${idx}`}
                    variants={scaleIn}
                    className="flex-shrink-0 w-[160px] md:w-auto md:flex-1 md:max-w-[200px]"
                  >
                    <Card 
                          className="p-4 rounded-xl border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                          style={{
                            background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${bgOpacity}), rgba(59, 130, 246, ${bgOpacity * 0.5}))`,
                            borderColor: `rgba(59, 130, 246, ${borderOpacity})`
                          }}
                          onClick={step.onClick}
                    >
                      <div className="flex flex-col items-center text-center">
                            <div 
                              className="h-12 w-12 rounded-full flex items-center justify-center mb-2 shadow-md"
                              style={{
                                background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${iconOpacity}), rgba(37, 99, 235, ${iconOpacity}))`
                              }}
                            >
                              <step.icon className="h-6 w-6 text-white" />
                        </div>
                            <h4 className="font-bold text-sm text-gray-900 mb-1.5">{step.title}</h4>
                        <p className="text-[10px] text-gray-600 leading-tight">
                              {step.description}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                    ];
                    
                    // Add arrow between steps (not after the last one)
                    if (idx < 4) {
                      elements.push(
                        <div key={`desktop-pipeline-arrow-${idx}`} className="flex items-center justify-center flex-shrink-0 mx-1 md:mx-2">
                    <ArrowRight className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                      );
                    }
                    
                    return elements;
                  })}
              </div>

              {/* Mobile view - marquee animation */}
              <div className="md:hidden relative overflow-hidden py-4">
                {/* Gradient overlays for fade effect */}
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                
                <div className="flex animate-marquee gap-4" style={{ width: 'max-content' }}>
                  {/* First set of pipeline steps */}
                  {[
                    { title: "AI-Leasing Agent", description: "Automatically follows up with every lead, answering questions and engaging prospects 24/7", icon: Bot, onClick: () => scrollToSection('ai-leasing-agent') },
                    { title: "AI Pre-Qualify", description: "AI screens prospects with customizable questions to identify serious applicants", icon: CheckCircle2, onClick: () => scrollToSection('smart-pre-screening') },
                    { title: "AI-Smart Scheduling", description: "Automatically books showings based on optimal availability and route efficiency", icon: Calendar, onClick: () => scrollToSection('ai-smart-scheduling') },
                    { title: "AI Application Processing", description: "Streamlines the entire application workflow from submission to approval", icon: FileText, onClick: () => scrollToSection('ai-application-processing') },
                    { title: "AI Leasing", description: "Generates state-compliant, customized lease agreements in minutes", icon: Shield, onClick: () => scrollToSection('ai-lease-drafting') },
                  ].map((step, idx) => {
                    // Calculate gradient opacity - starts at 0.35 and decreases to 0.05 (more noticeable)
                    const bgOpacity = 0.35 - (idx * 0.075); // 0.35, 0.275, 0.2, 0.125, 0.05
                    const borderOpacity = 0.7 - (idx * 0.15); // 0.7, 0.55, 0.4, 0.25, 0.1
                    const iconOpacity = 1 - (idx * 0.15); // 1, 0.85, 0.7, 0.55, 0.4
                    
                    return (
                    <div key={`pipeline-1-${idx}`} className="flex-shrink-0">
                      <Card 
                          className="p-4 rounded-xl border-2 shadow-lg w-[160px] cursor-pointer"
                          style={{
                            background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${bgOpacity}), rgba(59, 130, 246, ${bgOpacity * 0.5}))`,
                            borderColor: `rgba(59, 130, 246, ${borderOpacity})`
                          }}
                        onClick={step.onClick}
                      >
                        <div className="flex flex-col items-center text-center">
                            <div 
                              className="h-12 w-12 rounded-full flex items-center justify-center mb-2 shadow-md"
                              style={{
                                background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${iconOpacity}), rgba(37, 99, 235, ${iconOpacity}))`
                              }}
                            >
                            <step.icon className="h-6 w-6 text-white" />
                          </div>
                          <h4 className="font-bold text-sm text-gray-900 mb-1.5">{step.title}</h4>
                          <p className="text-[10px] text-gray-600 leading-tight">
                            {step.description}
                          </p>
                        </div>
                      </Card>
                    </div>
                    );
                  })}
                  
                  {/* Duplicate set for seamless loop */}
                  {[
                    { title: "AI-Leasing Agent", description: "Automatically follows up with every lead, answering questions and engaging prospects 24/7", icon: Bot, onClick: () => scrollToSection('ai-leasing-agent') },
                    { title: "AI Pre-Qualify", description: "AI screens prospects with customizable questions to identify serious applicants", icon: CheckCircle2, onClick: () => scrollToSection('smart-pre-screening') },
                    { title: "AI-Smart Scheduling", description: "Automatically books showings based on optimal availability and route efficiency", icon: Calendar, onClick: () => scrollToSection('ai-smart-scheduling') },
                    { title: "AI Application Processing", description: "Streamlines the entire application workflow from submission to approval", icon: FileText, onClick: () => scrollToSection('ai-application-processing') },
                    { title: "AI Leasing", description: "Generates state-compliant, customized lease agreements in minutes", icon: Shield, onClick: () => scrollToSection('ai-lease-drafting') },
                  ].map((step, idx) => {
                    // Calculate gradient opacity - starts at 0.35 and decreases to 0.05 (more noticeable)
                    const bgOpacity = 0.35 - (idx * 0.075); // 0.35, 0.275, 0.2, 0.125, 0.05
                    const borderOpacity = 0.7 - (idx * 0.15); // 0.7, 0.55, 0.4, 0.25, 0.1
                    const iconOpacity = 1 - (idx * 0.15); // 1, 0.85, 0.7, 0.55, 0.4
                    
                    return (
                    <div key={`pipeline-2-${idx}`} className="flex-shrink-0">
                      <Card 
                          className="p-4 rounded-xl border-2 shadow-lg w-[160px] cursor-pointer"
                          style={{
                            background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${bgOpacity}), rgba(59, 130, 246, ${bgOpacity * 0.5}))`,
                            borderColor: `rgba(59, 130, 246, ${borderOpacity})`
                          }}
                        onClick={step.onClick}
                      >
                        <div className="flex flex-col items-center text-center">
                            <div 
                              className="h-12 w-12 rounded-full flex items-center justify-center mb-2 shadow-md"
                              style={{
                                background: `linear-gradient(to bottom right, rgba(59, 130, 246, ${iconOpacity}), rgba(37, 99, 235, ${iconOpacity}))`
                              }}
                            >
                            <step.icon className="h-6 w-6 text-white" />
                          </div>
                          <h4 className="font-bold text-sm text-gray-900 mb-1.5">{step.title}</h4>
                          <p className="text-[10px] text-gray-600 leading-tight">
                            {step.description}
                          </p>
                        </div>
                      </Card>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Countdown Timer */}
          <motion.div
            variants={fadeInUp}
            className="mb-12"
          >
            <Card className="max-w-3xl mx-auto border-2 shadow-lg" style={{ borderColor: 'rgba(255, 223, 0, 0.3)', backgroundColor: 'rgba(255, 223, 0, 0.05)' }}>
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
                    <Rocket className="h-4 w-4" />
                    <span className="text-xs font-semibold">Founding Partner Early Access</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#CCB300' }}>
                    Launch Countdown
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Join now to secure your founding partner access before launch
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                      {String(timeRemaining.days).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                      {String(timeRemaining.hours).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                      {String(timeRemaining.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Minutes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1" style={{ color: '#FFDF00' }}>
                      {String(timeRemaining.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Seconds</div>
                  </div>
                </div>
                <div className="text-center mt-6">
                  <Button
                    onClick={handleBecomeFoundingPartner}
                    className="text-white hover:opacity-90"
                    style={{ backgroundColor: '#FFDF00' }}
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    Get Early Premium Access
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          </motion.div>
        </div>
      </section>

      {/* AI Leasing Agent - The Star Feature */}
      <section id="ai-leasing-agent" className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20 relative">
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
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Your 24/7 AI Leasing Agent
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
                Never miss a lead again. Our AI Leasing Agent works around the
                clock to engage prospects, answer questions, pre-screen
                applicants, and book showings—automatically. It works just like
                a real leasing agent, learning from every conversation to get
                smarter over time.
              </p>
              {/* KPIs for Rent Engine */}
              <div className="flex flex-wrap justify-center gap-4 mb-4">
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">42%</div>
                  <div className="text-xs text-blue-700">Lead to Tour Rate</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">150%</div>
                  <div className="text-xs text-blue-700">Time to Tour</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">15</div>
                  <div className="text-xs text-blue-700">Weekday Hours Saved</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">33%</div>
                  <div className="text-xs text-blue-700">Higher Lease Conversion</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center mb-6">
                KPIs are based on market research
              </p>
              <div className="text-center mb-8">
                <Button
                  onClick={handleSeeItInAction}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
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
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Intelligent Multi-Channel AI Communication</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        <strong>Email:</strong> AI-powered email responses via Gmail and Outlook with intelligent timing and personalization
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        <strong>Text (SMS):</strong> Automated SMS follow-ups and two-way conversations to engage leads instantly
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        <strong>Voice Calls:</strong> AI-powered phone calls that can answer questions, schedule showings, and qualify leads in real-time
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Unified inbox across all channels with context-aware responses and Auto-Pilot or Co-Pilot mode
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={scaleIn} id="smart-pre-screening">
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
                      <p className="text-sm text-foreground">
                        Ask qualifying questions (income, move-in date,
                        evictions)
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Train your AI with custom screening criteria
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Ingests your property data and qualification
                        requirements
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
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
                      <p className="text-foreground">
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
      <section id="convert-every-lead" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
              >
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">Convert Every Lead</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Lead2Lease follows up with every prospect automatically,
                  sending the right message based on their unique situation,
                  property preferences, and stage in the rental journey.
                </p>
                {/* KPIs for respage */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">113%</div>
                    <div className="text-xs text-blue-700">Increase in Appointments</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">62%</div>
                    <div className="text-xs text-blue-700">Increase in Tours YOY</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">69%</div>
                    <div className="text-xs text-blue-700">Tours Booked After Hours</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">86%</div>
                    <div className="text-xs text-blue-700">Inquiries Handled by AI</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">50%</div>
                    <div className="text-xs text-blue-700">Higher Compensation</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">33%</div>
                    <div className="text-xs text-blue-700">Higher Lease Conversion</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mb-6">
                  KPIs are based on market research
                </p>
                <div className="text-center mb-6">
                  <Button
                    onClick={handleSeeItInAction}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    See it in action
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
                className="space-y-6"
              >
                <Card className="p-8 border-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">
                        New inquiry received
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        AI responds in 30 seconds
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">
                        No response after 24 hours
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        AI sends personalized follow-up
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-sm text-foreground">
                        Lead shows interest
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        AI books showing automatically
                      </span>
                    </div>
                  </div>
                </Card>
                
                {/* Feature Benefits - Only visible on desktop */}
                <div className="hidden md:block">
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
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CRM Section */}
      <section id="crm" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                CRM
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8">
                Complete customer relationship management system to track leads, prospects, and resident interactions throughout the entire leasing lifecycle. Keep all your customer data organized, accessible, and actionable in one centralized platform.
              </p>
              <div className="text-center mb-8">
                <Button
                  onClick={handleSeeItInAction}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Lead & Prospect Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Track every lead from first contact to signed lease
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Complete interaction history across all channels
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Lead scoring and qualification status tracking
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Property preferences and search history
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Resident Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Manage current residents and lease information
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Application and lease document storage
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Communication history
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Renewal and move-out tracking
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn}
              >
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Unified Communication Hub</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        All conversations in one place
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Email, SMS, and voice call history
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Team collaboration and notes
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">
                        Automated follow-up reminders
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Scheduling */}
      <section id="ai-smart-scheduling" className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20 relative">
            <motion.div
              className="text-center mb-12 relative z-20"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                AI-Smart Scheduling
              </h2>
              {/* KPIs for Smart Scheduling */}
              <div className="flex flex-wrap justify-center gap-4 mb-4">
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">69%</div>
                  <div className="text-xs text-blue-700">Tours Booked After Hours</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">113%</div>
                  <div className="text-xs text-blue-700">Increase in Appointments</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center mb-6">
                KPIs are based on market research
              </p>
              <div className="text-center mb-8">
                <Button
                  onClick={handleSeeItInAction}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
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
                <p className="text-foreground mb-4">
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
                <p className="text-foreground mb-4">
                  Offer secure, contactless showings that prospects can book
                  instantly.
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
      <section id="ai-application-processing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div 
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                AI-Powered Application Processing
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
                From showing to approved application in record time. Our AI
                handles the entire application workflow while you maintain full
                control.
              </p>
              <div className="text-center mb-8">
                <Button
                  onClick={handleSeeItInAction}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
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
                  <p className="text-sm text-foreground">
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
                  <p className="text-sm text-foreground">
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
                  <p className="text-sm text-foreground">
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
      <section id="ai-lease-drafting" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
              >
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">AI Lease Drafting</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Generate state-compliant, customized lease agreements in
                  minutes. Our AI understands tenant-landlord laws and
                  automatically incorporates your property-specific terms.
                </p>
                {/* KPIs for lethub */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">40%</div>
                    <div className="text-xs text-blue-700">More Lead2Lease</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">70%</div>
                    <div className="text-xs text-blue-700">Time Saved for PMs</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mb-6">
                  KPIs are based on market research
                </p>
                <div className="text-center mb-6">
                  <Button
                    onClick={handleSeeItInAction}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    See it in action
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
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
                    <span className="font-semibold text-foreground">
                      Lease Drafting Process
                    </span>
                    <span className="text-xs text-muted-foreground">~3 minutes</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        1
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          AI reviews conversation & application
                        </div>
                        <div className="text-xs text-muted-foreground">
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
                        <div className="text-sm font-medium text-foreground">
                          Generates state-compliant draft
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Incorporates property terms and legal requirements
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        3
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          You review and approve
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Or enable Auto-Pilot for instant delivery
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 mt-4 border-t space-y-4">
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
                </div>
              </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Reporting & Analytics */}
      <section id="reporting" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto border-t border-gray-200 pt-20 -mt-20">
            <motion.div 
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">Reporting Made Easy</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
                Beautiful owner reports with customizable showing feedback and
                detailed metrics on every aspect of your leasing operation.
                Plus, chat with your data using Intelligence AI.
              </p>
              <div className="text-center mb-8">
                <Button
                  onClick={handleSeeItInAction}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  See it in action
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
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
                  <p className="text-foreground mb-4">
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
                  <p className="text-foreground mb-4">
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
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
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
                  <p className="text-foreground mb-4">
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
                  <p className="text-foreground mb-4">
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
                No matter your portfolio size, Lead2Lease delivers positive
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
                  <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                    We're Here for You, 24/7
                  </h2>
                  <p className="text-lg text-foreground mb-6 max-w-2xl mx-auto">
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

      {/* Integrations Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <Plug className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Seamless Integrations
                </span>
              </div>
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Connect with Your Existing Tools
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                Lead2Lease will integrate seamlessly with the platforms you already use, 
                from listing sites to property management systems. Coming soon - sync data automatically 
                and manage everything from one place.
              </p>
            </motion.div>

            {/* Horizontal Scrolling Integrations Marquee */}
            <div className="relative overflow-hidden mb-8 py-4">
              {/* Gradient overlays for fade effect */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
              
              <div className="flex animate-marquee gap-4" style={{ width: 'max-content' }}>
                {/* First set of integrations */}
                {[
                  // ILS
                  { name: "Apartments.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "Zillow", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Realtor.com", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Rent.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "Apartment Finder", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Rentals.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "HotPads", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Trulia", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  // PMS
                  { name: "AppFolio", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "Buildium", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "Yardi", icon: <Building2 className="h-6 w-6" />, category: "PMS" },
                  { name: "Rent Manager", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "Propertyware", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "Entrata", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "MRI Software", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "RealPage", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  // Communication
                  { name: "Gmail", icon: <Mail className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Outlook", icon: <Mail className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Google Calendar", icon: <Calendar className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Facebook Messenger", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Available" },
                  { name: "Twilio SMS", icon: <Phone className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Slack", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Microsoft Teams", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Zapier", icon: <Plug className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                ].map((platform, idx) => (
                  <div
                    key={`${platform.name}-1`}
                    className="flex-shrink-0"
                  >
                    <Card className="w-[180px] h-[120px] p-4 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200">
                      <div className="flex flex-col items-center gap-3 h-full justify-center">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {platform.icon}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{platform.name}</div>
                      </div>
                    </Card>
                  </div>
                ))}
                
                {/* Duplicate set for seamless loop */}
                {[
                  // ILS
                  { name: "Apartments.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "Zillow", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Realtor.com", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Rent.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "Apartment Finder", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Rentals.com", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  { name: "HotPads", icon: <Home className="h-6 w-6" />, category: "ILS" },
                  { name: "Trulia", icon: <Building2 className="h-6 w-6" />, category: "ILS" },
                  // PMS
                  { name: "AppFolio", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "Buildium", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "Yardi", icon: <Building2 className="h-6 w-6" />, category: "PMS" },
                  { name: "Rent Manager", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "Propertyware", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "Entrata", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  { name: "MRI Software", icon: <Cloud className="h-6 w-6" />, category: "PMS" },
                  { name: "RealPage", icon: <Database className="h-6 w-6" />, category: "PMS" },
                  // Communication
                  { name: "Gmail", icon: <Mail className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Outlook", icon: <Mail className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Google Calendar", icon: <Calendar className="h-6 w-6" />, category: "Comm", status: "Connected" },
                  { name: "Facebook Messenger", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Available" },
                  { name: "Twilio SMS", icon: <Phone className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Slack", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Microsoft Teams", icon: <MessageSquare className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                  { name: "Zapier", icon: <Plug className="h-6 w-6" />, category: "Comm", status: "Coming Soon" },
                ].map((platform, idx) => (
                  <div
                    key={`${platform.name}-2`}
                    className="flex-shrink-0"
                  >
                    <Card className="w-[180px] h-[120px] p-4 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200">
                      <div className="flex flex-col items-center gap-3 h-full justify-center">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {platform.icon}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{platform.name}</div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              className="text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <Button
                onClick={handleSeeItInAction}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Explore All Integrations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Founding Partner Membership */}
      <section className="py-6 md:py-8 lg:py-20 bg-gradient-to-b from-white to-gray-50 overflow-x-hidden" data-testid="section-founding-partner">
        <div className="container mx-auto px-3 md:px-4 w-full max-w-full overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full overflow-x-hidden">
            <motion.div
              className="text-center mb-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-1" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
                <Crown className="h-3 w-3" />
                <span className="text-xs font-semibold">Limited Founding Partner Spots</span>
              </div>
              <h2 className="text-xl md:text-3xl font-bold mb-1 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Become a Founding Partner
              </h2>
              <p className="text-xs md:text-base text-gray-600 max-w-2xl mx-auto">
                Get full access to Lead2Lease's complete AI-powered property leasing platform with exclusive founding partner pricing.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scaleIn}
            >
              <div className="grid lg:grid-cols-3 gap-3 md:gap-4 w-full overflow-x-hidden">
                {/* Left column - Features (moved second on mobile) */}
                <div className="lg:col-span-2 order-2 lg:order-1 space-y-3 w-full min-w-0">
                  {/* Platform Features */}
                  <Card className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 1))' }}>
                    {/* Gold gradient blend from edges */}
                    <div className="absolute inset-0 pointer-events-none" style={{ 
                      background: 'radial-gradient(ellipse at top left, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at top right, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(255, 223, 0, 0.1) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255, 223, 0, 0.1) 0%, transparent 50%)'
                    }}></div>
                    <CardHeader className="pb-2 px-3 md:px-4 pt-3 md:pt-4 relative z-10" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.08), rgba(255, 223, 0, 0.03))' }}>
                      <div className="mb-2">
                        <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                          <Zap className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" style={{ color: '#FFDF00' }} />
                          <span className="whitespace-nowrap">Everything You Get with Lead2Lease</span>
                        </CardTitle>
                      </div>
                      <p className="text-[10px] md:text-xs text-gray-600 mt-1">Complete AI-powered leasing platform with all features included</p>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-2 md:px-4 relative z-10 overflow-x-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Bot className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">AI Leasing Agent</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">24/7 intelligent lead qualification and response. Your AI handles inquiries, answers questions, and pre-qualifies prospects automatically.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Users className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">CRM</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Complete customer relationship management system to track leads, prospects, and resident interactions throughout the entire leasing lifecycle. Centralize all customer data, communication history, and pipeline stages in one powerful platform.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Calendar className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Smart Showing Scheduler</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Intelligent booking system with conflict detection, buffer times, and automatic availability sync across your calendar.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <MessageSquare className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Multi-Channel Communication</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Unified inbox for Gmail, Outlook, SMS (Twilio), and Facebook Messenger. Never miss a lead again.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <BarChart3 className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Advanced Analytics Dashboard</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Track conversion rates, response times, lead sources, and AI performance metrics in real-time.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Building2 className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Property & Unit Management</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Complete portfolio management with individual unit scheduling, custom availability, and listing sync.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Zap className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Automated Lead Qualification</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Customizable pre-screening questions with scoring. Filter serious prospects before they book showings.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Clock className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Showing Reminders</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Automatic email reminders to leads before scheduled showings. Reduce no-shows by up to 80%.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Mail className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Calendar Integrations</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Two-way sync with Google Calendar, Outlook, and other popular calendar platforms. Showings appear automatically with all details.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <FileText className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">AI Leasing</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Automated lease generation, review, and management with AI-powered document processing and compliance checks.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <FileText className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">AI Powered Application Processing</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Streamline rental applications with intelligent document review, background check integration, and automated decision support.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                            <Plug className="h-3 w-3" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-semibold text-xs text-gray-900 break-words">Many Integrations Coming Soon</div>
                            <p className="text-[10px] leading-tight text-gray-600 break-words">Coming soon - connect with popular ILS platforms, PMS systems, payment processors, and communication tools for seamless workflow integration.</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-3 italic text-center">Note: All features mentioned might not be available right away.</p>
                      
                      {/* ROI KPIs Section */}
                      <div className="mt-3 pt-3 border-t">
                        <h4 className="font-semibold text-xs text-gray-900 mb-2 text-center bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">Customers have seen a increase in the following when using AI-Powered Leasing Automation Software</h4>
                        {/* Desktop view - grid layout */}
                        <div className="hidden md:grid grid-cols-5 gap-1.5 w-full overflow-x-hidden">
                          <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                            <TrendingUp className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                            <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>42%</div>
                            <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Lead to Tour</div>
                          </div>
                          <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                            <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                            <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>70%</div>
                            <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Time Saved</div>
                          </div>
                          <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                            <Calendar className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                            <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>113%</div>
                            <div className="text-[11px] md:text-[12px] text-gray-600 break-words">More Appointments</div>
                          </div>
                          <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                            <TrendingDown className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                            <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>9</div>
                            <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Fewer Days</div>
                          </div>
                          <div className="text-center p-1.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                            <FileCheck className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                            <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>40%</div>
                            <div className="text-[11px] md:text-[12px] text-gray-600 break-words">More Leases</div>
                          </div>
                        </div>
                        {/* Mobile view - marquee animation */}
                        <div className="md:hidden relative overflow-hidden py-2">
                          {/* Gradient overlays for fade effect */}
                          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                          
                          <div className="flex animate-marquee gap-2" style={{ width: 'max-content', willChange: 'transform' }}>
                            {/* First set of ROI KPIs */}
                            {[
                              { value: "42%", label: "Lead to Tour", icon: TrendingUp },
                              { value: "70%", label: "Time Saved", icon: Clock },
                              { value: "113%", label: "More Appointments", icon: Calendar },
                              { value: "9", label: "Fewer Days", icon: TrendingDown },
                              { value: "40%", label: "More Leases", icon: FileCheck },
                            ].map((kpi, idx) => {
                              const IconComponent = kpi.icon;
                              return (
                              <div key={`roi-1-${idx}`} className="flex-shrink-0">
                                  <div className="text-center p-1.5 rounded-lg border w-[100px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                                    <IconComponent className="h-[18px] w-[18px] mx-auto mb-1" style={{ color: '#CCB300' }} />
                                    <div className="text-lg font-bold mb-0.5" style={{ color: '#CCB300' }}>{kpi.value}</div>
                                  <div className="text-[12px] text-gray-600">{kpi.label}</div>
                                </div>
                              </div>
                              );
                            })}
                            
                            {/* Duplicate set for seamless loop */}
                            {[
                              { value: "42%", label: "Lead to Tour", icon: TrendingUp },
                              { value: "70%", label: "Time Saved", icon: Clock },
                              { value: "113%", label: "More Appointments", icon: Calendar },
                              { value: "9", label: "Fewer Days", icon: TrendingDown },
                              { value: "40%", label: "More Leases", icon: FileCheck },
                            ].map((kpi, idx) => {
                              const IconComponent = kpi.icon;
                              return (
                              <div key={`roi-2-${idx}`} className="flex-shrink-0">
                                  <div className="text-center p-1.5 rounded-lg border w-[100px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                                    <IconComponent className="h-[18px] w-[18px] mx-auto mb-1" style={{ color: '#CCB300' }} />
                                    <div className="text-lg font-bold mb-0.5" style={{ color: '#CCB300' }}>{kpi.value}</div>
                                  <div className="text-[12px] text-gray-600">{kpi.label}</div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-2">
                          KPIs are based on market research
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Founder Benefits */}
                  <Card className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.08), rgba(255, 255, 255, 0.98))' }}>
                    {/* Gold gradient overlay */}
                    <div className="absolute inset-0 pointer-events-none" style={{ 
                      background: 'radial-gradient(ellipse at top, rgba(255, 223, 0, 0.12) 0%, transparent 60%)'
                    }}></div>
                    <CardHeader className="pb-3 px-3 md:px-4 pt-4 md:pt-5 relative z-10" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.15), rgba(255, 223, 0, 0.08))' }}>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                        <Crown className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                        Exclusive Founding Partner Benefits
                      </CardTitle>
                      <p className="text-xs md:text-sm text-gray-600 mt-2">Premium perks reserved for our founding partners</p>
                    </CardHeader>
                    <CardContent className="p-4 md:p-5 pt-0 relative z-10">
                      <div className="space-y-4 md:space-y-5">
                        <div className="flex items-start gap-2 md:gap-3 pt-2">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Rocket className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">Early Access Features</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">First to try new AI capabilities</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Star className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">Priority Feature Requests</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">Shape our development roadmap</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Users className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">Direct Founder Access</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">Personal communication channel</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Lock className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">Lifetime Discount</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">Get lifetime discount as a founding partner</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Headphones className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">White-Glove Onboarding</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">Personalized setup and training included</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                            <Zap className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm md:text-base text-gray-900 mb-1">Custom Made Software</div>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">Get a solution that feels custom-built for your business with tailored configurations and workflows</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Enterprise Customization Value Proposition */}
                  <Card className="border-2 shadow-xl relative overflow-visible" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), rgba(255, 255, 255, 0.98))' }}>
                    {/* Gold gradient overlay */}
                    <div className="absolute inset-0 pointer-events-none" style={{ 
                      background: 'radial-gradient(ellipse at center, rgba(255, 223, 0, 0.1) 0%, transparent 70%)'
                    }}></div>
                    <CardContent className="p-4 md:p-6 relative z-10">
                      <div className="text-center mb-4">
                        <h3 className="font-bold text-base md:text-xl mb-2 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                        Get Enterprise-Level Customization Without the Enterprise Price Tag
                      </h3>
                        <p className="text-sm md:text-base text-gray-700 font-medium">
                          Building a custom AI leasing solution costs hundreds of thousands. Lead2Lease delivers that same tailored experience for just <span className="font-bold text-primary">${enterpriseSectionPrice}</span>.
                      </p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-6 w-full overflow-x-hidden">
                        {/* Traditional Custom Development */}
                        <div className="space-y-3 p-3 md:p-4 rounded-lg border-2 bg-white w-full min-w-0" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.02), rgba(255, 255, 255, 1))' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-red-600 font-bold text-sm">✗</span>
                            </div>
                            <div className="font-bold text-sm md:text-base lg:text-lg text-gray-900 break-words">Traditional Custom</div>
                            </div>
                          <div className="space-y-2 text-xs md:text-sm lg:text-base">
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50/50 min-w-0">
                              <span className="text-red-500 mt-0.5 font-bold flex-shrink-0">•</span>
                              <span className="flex-1 text-gray-700 font-medium break-words">$100,000+ upfront</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50/50 min-w-0">
                              <span className="text-red-500 mt-0.5 font-bold flex-shrink-0">•</span>
                              <span className="flex-1 text-gray-700 font-medium break-words">6-12 months dev</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50/50 min-w-0">
                              <span className="text-red-500 mt-0.5 font-bold flex-shrink-0">•</span>
                              <span className="flex-1 text-gray-700 font-medium break-words">Ongoing maintenance</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50/50 min-w-0">
                              <span className="text-red-500 mt-0.5 font-bold flex-shrink-0">•</span>
                              <span className="flex-1 text-gray-700 font-medium break-words">Tech team needed</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50/50 min-w-0">
                              <span className="text-red-500 mt-0.5 font-bold flex-shrink-0">•</span>
                              <span className="flex-1 text-gray-700 font-medium break-words">Project risk</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Lead2Lease Founding Member */}
                        <div className="space-y-3 p-3 md:p-4 rounded-lg border-2 relative w-full min-w-0 overflow-visible" style={{ borderColor: 'rgba(255, 223, 0, 0.5)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.1), rgba(255, 223, 0, 0.05))' }}>
                          <div className="absolute top-2 right-2 z-10">
                            <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] lg:text-xs font-bold uppercase tracking-wide text-white shadow-lg" style={{ backgroundColor: '#CCB300' }}>
                              <Crown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                              <span className="whitespace-nowrap">Best Value</span>
                            </span>
                            </div>
                          <div className="flex items-center gap-2 mb-3 min-w-0">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.3)' }}>
                              <CheckCircle2 className="h-5 w-5" style={{ color: '#CCB300' }} />
                            </div>
                            <div className="font-bold text-sm md:text-base lg:text-lg break-words" style={{ color: '#CCB300' }}>Lead2Lease</div>
                            </div>
                          <div className="space-y-2 text-xs md:text-sm lg:text-base">
                            <div className="flex items-start gap-2 p-2 rounded min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                              <span className="text-green-600 mt-0.5 font-bold flex-shrink-0">✓</span>
                              <span className="flex-1 text-gray-800 font-semibold break-words">${enterpriseSectionPrice}</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                              <span className="text-green-600 mt-0.5 font-bold flex-shrink-0">✓</span>
                              <span className="flex-1 text-gray-800 font-semibold break-words">Deploy in days</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 rounded min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                              <span className="text-green-600 mt-0.5 font-bold flex-shrink-0">✓</span>
                              <span className="flex-1 text-gray-800 font-semibold break-words">Zero maintenance</span>
                          </div>
                            <div className="flex items-start gap-2 p-2 rounded min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                              <span className="text-green-600 mt-0.5 font-bold flex-shrink-0">✓</span>
                              <span className="flex-1 text-gray-800 font-semibold break-words">No tech expertise</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 p-4 rounded-lg text-center" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', border: '1px solid rgba(255, 223, 0, 0.3)' }}>
                        <p className="text-sm md:text-base text-gray-800 font-semibold">
                        Why pay hundreds of thousands when you can get a solution that feels custom-built for your business at a fraction of the cost?
                      </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right column - Pricing Card (moved first on mobile) */}
                <div className="order-1 lg:order-2 w-full min-w-0 lg:self-start">
                  <Card className="shadow-xl sticky top-20 md:top-24 lg:top-24 overflow-hidden border-2 w-full max-w-full z-10 lg:max-h-[calc(100vh-6rem)]" style={{ borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                    <CardHeader className="text-white rounded-t-lg py-3 md:py-4 px-3 md:px-4 relative" style={{ background: 'linear-gradient(to right, #FFDF00, #E6C900)' }}>
                      <div className="absolute top-2 right-2 md:top-3 md:right-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wide text-white shadow-md" style={{ backgroundColor: '#CCB300' }}>
                          <span className="animate-pulse">⚡</span>
                          Limited Offer
                        </span>
                      </div>
                      <CardTitle className="flex items-center justify-between text-base md:text-lg">
                        <span>Founding Partner</span>
                      </CardTitle>
                      <div className="mt-1">
                        <span className="text-2xl md:text-3xl font-bold">${enterpriseSectionPrice}</span>
                        <span className="ml-1 opacity-90 text-xs md:text-sm">upfront payment</span>
                      </div>
                      <p className="text-[10px] md:text-xs mt-1 opacity-90">Monthly recurring begins post-launch</p>
                      <div className="mt-2 px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm border border-white/30">
                        <p className="text-xs md:text-sm font-bold text-white text-center">Money back guarantee</p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div className="space-y-3 md:space-y-4">
                        <Button
                          size="lg"
                          className="w-full text-sm md:text-base py-4 md:py-5 text-white hover:opacity-90"
                          style={{ backgroundColor: '#FFDF00' }}
                          onClick={handleBecomeFoundingPartner}
                          data-testid="button-founding-partner-join"
                        >
                          <Crown className="mr-2 h-4 w-4" />
                          Start Your Membership
                        </Button>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-gray-500">
                        <Shield className="h-3 w-3" />
                        <span>Secure payment via Stripe</span>
                      </div>

                      <div className="text-center text-[10px] md:text-xs text-gray-400">
                        <p>Cancel anytime • 256-bit SSL encryption</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
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
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Ready to Fill Your Vacancies Faster?
              </h2>
              <p className="text-lg text-foreground mb-8 max-w-2xl mx-auto">
                Join property managers who are using Lead2Lease to generate more
                leads, book more showings, and close more leases—all while
                reducing vacancy costs by 40%.
              </p>
              <div className="flex gap-4 flex-wrap justify-center mb-8">
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    variant="outline"
                    data-testid="button-book-demo-cta"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-lg px-8 py-6 border-2 border-blue-600 rounded-xl transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
                  >
                    Schedule a Demo
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <section className="relative overflow-hidden min-h-[400px]">
        {/* Background layer that will be blurred under the footer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-8 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
          <div className="absolute top-0 -right-8 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-10 left-20 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
          <div className="absolute top-1/2 -left-4 w-96 h-96 bg-primary/10 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/12 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-1000"></div>
        </div>

        {/* Footer content must be above the background */}
        <footer className="relative z-10 border-t border-white/20 bg-white/80 backdrop-blur-md backdrop-saturate-150 shadow-sm">
          <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link href="/">
                <img 
                  src={logoBlack} 
                  alt="Lead2Lease Logo" 
                  className="h-10 md:h-12 w-auto object-contain mx-auto cursor-pointer"
                />
              </Link>
            </div>
            {/* Tagline */}
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Faster leasing starts here.
              </h3>
            </div>

            {/* Footer Navigation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              {/* Platform */}
              <div>
                <h4 className="font-semibold text-foreground mb-4">Platform</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <button
                      onClick={handleSignIn}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Login
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        const hostname = window.location.hostname.toLowerCase();
                        const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
                        if (isProductionMarketing) {
                          window.location.href = 'https://app.lead2lease.ai/register';
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setLocation('/register');
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={handleBecomeFoundingPartner}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Get Early Access
                    </button>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="font-semibold text-foreground mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/book-demo"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Book Demo
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Help */}
              <div>
                <h4 className="font-semibold text-foreground mb-4">Help</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a
                      href="mailto:support@lead2lease.ai"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Support
                    </a>
                  </li>
                  <li>
                    <Link
                      href="/terms-of-service"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy-notice"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Privacy Notice
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cookies-policy"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cookies Policy
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-semibold text-foreground mb-4">Contact Info</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <a
                      href="mailto:support@lead2lease.ai"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      support@lead2lease.ai
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t pt-8 text-center text-sm">
              <p className="text-muted-foreground">
                Lead2Lease is an AI-powered leasing technology platform. |
                Copyright © 2025 Lead2Lease. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
      </section>

      {/* Demo Dialog - Appears after 1 minute */}
      <Dialog open={showDemoDialog} onOpenChange={setShowDemoDialog}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white">
          <div className="bg-white p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                <Calendar className="h-5 w-5 text-blue-600" />
                Book a Demo
              </DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
                See Lead2Lease in action. Enter your email and we'll schedule a personalized demo.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleDemoSubmit}>
            <div className="grid gap-4 p-6 bg-white">
              <div className="grid gap-2">
                <Label htmlFor="demo-email" className="text-sm font-medium">Email</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  required
                  disabled={isSubmittingDemo}
                  className="h-10"
                />
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 gap-2 bg-white">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDemoDialog(false)}
                disabled={isSubmittingDemo}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingDemo || !demoEmail}
                className="flex-1 text-white bg-gradient-to-r from-primary via-blue-600 to-blue-700 hover:opacity-90"
              >
                {isSubmittingDemo ? "Submitting..." : "Book Demo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap the entire page in ThemeProvider forcing light mode for consistent branding
export default function Landing() {
  return (
    <ThemeProvider forcedTheme="light">
      <LandingContent />
    </ThemeProvider>
  );
}
