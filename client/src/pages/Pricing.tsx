import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { PublicHeader } from "@/components/PublicHeader";
import {
  Crown,
  Rocket,
  Star,
  Users,
  Lock,
  Headphones,
  CheckCircle2,
  Bot,
  Calendar,
  MessageSquare,
  BarChart3,
  Building2,
  Zap,
  Clock,
  Mail,
  ArrowRight,
  DollarSign,
  Shield,
  FileText,
  Phone,
  ChevronDown,
  Plug,
  FileCheck,
  ClipboardCheck,
  Menu,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function PricingContent() {
  const [, setLocation] = useLocation();

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
  
  const displayPrice = priceData?.formattedAmount || "149.99";

  const handleSignIn = () => {
    setLocation("/login");
  };

  const handleGetStarted = () => {
    setLocation(`/login?returnTo=${encodeURIComponent('/founding-partner-checkout')}`);
  };

  const scrollToSection = (sectionId: string) => {
    // Delay to allow menu to close first
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            const offset = 100; // Offset for sticky header
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
              top: Math.max(0, offsetPosition),
              behavior: 'smooth'
            });
          }
        });
      });
    }, 300);
  };

  const platformFeatures = [
    { icon: Bot, title: "AI Leasing Agent", description: "24/7 intelligent lead qualification and response. Your AI handles inquiries, answers questions, and pre-qualifies prospects automatically." },
    { icon: Users, title: "CRM", description: "Complete customer relationship management system to track leads, prospects, and resident interactions throughout the entire leasing lifecycle. Centralize all customer data, communication history, and pipeline stages in one powerful platform." },
    { icon: Calendar, title: "Smart Showing Scheduler", description: "Intelligent booking system with conflict detection, buffer times, and automatic availability sync across your calendar." },
    { icon: MessageSquare, title: "Multi-Channel Communication", description: "Unified inbox for Gmail, Outlook, SMS (Twilio), and Facebook Messenger. Never miss a lead again." },
    { icon: BarChart3, title: "Advanced Analytics Dashboard", description: "Track conversion rates, response times, lead sources, and AI performance metrics in real-time." },
    { icon: Building2, title: "Property & Unit Management", description: "Complete portfolio management with individual unit scheduling, custom availability, and listing sync." },
    { icon: Zap, title: "Automated Lead Qualification", description: "Customizable pre-screening questions with scoring. Filter serious prospects before they book showings." },
    { icon: Clock, title: "Showing Reminders", description: "Automatic email reminders to leads before scheduled showings. Reduce no-shows by up to 80%." },
    { icon: Mail, title: "Calendar Integrations", description: "Two-way sync with Google Calendar, Outlook, and other popular calendar platforms. Showings appear automatically with all details." },
    { icon: FileText, title: "AI Lease Drafting", description: "Generate state-compliant, customized lease agreements in minutes with AI-powered templates." },
    { icon: Phone, title: "AI Calling Agent", description: "Coming soon - AI voice agent that answers calls, qualifies leads, and creates tasks for your team." },
    { icon: FileCheck, title: "AI Leasing", description: "Automated lease generation, review, and management with AI-powered document processing and compliance checks." },
    { icon: ClipboardCheck, title: "AI Powered Application Processing", description: "Streamline rental applications with intelligent document review, background check integration, and automated decision support." },
    { icon: Plug, title: "Many Integrations Coming Soon", description: "Coming soon - connect with popular ILS platforms, PMS systems, payment processors, and communication tools for seamless workflow integration." },
  ];

  const founderBenefits = [
    { icon: Rocket, title: "Early Access Features", description: "First to try new AI capabilities" },
    { icon: Star, title: "Priority Feature Requests", description: "Shape our development roadmap" },
    { icon: Users, title: "Direct Founder Access", description: "Personal communication channel" },
    { icon: Lock, title: "Lifetime Discount", description: "Get lifetime discount as a founding partner" },
    { icon: Headphones, title: "White-Glove Onboarding", description: "Personalized setup and training included" },
    { icon: Zap, title: "Custom Made Software", description: "Get a solution that feels custom-built for your business with tailored configurations and workflows" },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header - Shared Component */}
      <PublicHeader 
        onGetEarlyAccess={handleGetStarted}
        currentPage="pricing"
      />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-4 md:py-6 pt-20 md:pt-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 223, 0, 0.2)', color: '#CCB300' }}>
            <Crown className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm font-semibold">Founding Partner Membership</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent px-2">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-4 max-w-2xl mx-auto px-2">
            One plan. All features. Exclusive founding partner pricing.
          </p>
        </div>
      </section>

      {/* Main Content - 3 Column Layout */}
      <section className="container mx-auto px-3 md:px-4 pb-6 md:pb-8 overflow-x-hidden w-full max-w-full">
        <div className="max-w-6xl mx-auto w-full overflow-x-hidden">
          <div className="grid lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6 w-full overflow-x-hidden">
            {/* Left column - Features (moved second on mobile) */}
            <div className="lg:col-span-2 order-2 lg:order-1 space-y-3 md:space-y-4 w-full min-w-0">
              {/* Platform Features */}
              <Card id="features" className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 1))' }}>
                {/* Gold gradient blend from edges */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  background: 'radial-gradient(ellipse at top left, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at top right, rgba(255, 223, 0, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(255, 223, 0, 0.1) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255, 223, 0, 0.1) 0%, transparent 50%)'
                }}></div>
                <CardHeader className="pb-2 px-3 md:px-6 pt-3 md:pt-6 relative z-10" style={{ background: 'linear-gradient(to right, rgba(255, 223, 0, 0.08), rgba(255, 223, 0, 0.03))' }}>
                  <div className="mb-2">
                    <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                      <Zap className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" style={{ color: '#FFDF00' }} />
                      <span className="whitespace-nowrap">Everything You Get with Lead2Lease</span>
                    </CardTitle>
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-600 mt-1">Complete AI-powered leasing platform with all features included</p>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-2 md:px-3 lg:px-6 relative z-10 overflow-x-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 w-full">
                    {platformFeatures.map((feature, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-1.5 md:gap-2 p-1.5 md:p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors w-full min-w-0"
                      >
                        <div className="h-5 w-5 md:h-6 md:w-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <feature.icon className="h-2.5 w-2.5 md:h-3 md:w-3" style={{ color: '#CCB300' }} />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-semibold text-xs md:text-sm text-gray-900 break-words">
                            {feature.title}
                          </div>
                          <p className="text-[10px] md:text-xs leading-tight text-gray-600 mt-0.5 break-words">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] md:text-xs text-gray-500 mt-3 italic text-center">Note: All features mentioned might not be available right away.</p>
                  
                  {/* ROI KPIs Section */}
                  <div className="mt-3 md:mt-4 pt-3 border-t">
                    <h4 className="font-semibold text-xs md:text-sm text-gray-900 mb-2 text-center bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">Customers have seen a increase in the following when using AI-Powered Leasing Automation Software</h4>
                    {/* Desktop view - grid layout */}
                    <div className="hidden md:grid grid-cols-5 gap-1.5 md:gap-2">
                      <div className="text-center p-2 md:p-2.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <TrendingUp className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>42%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Lead to Tour</div>
                      </div>
                      <div className="text-center p-2 md:p-2.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <Clock className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>70%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Time Saved</div>
                      </div>
                      <div className="text-center p-2 md:p-2.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <Calendar className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>113%</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">More Appointments</div>
                      </div>
                      <div className="text-center p-2 md:p-2.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                        <TrendingDown className="h-5 w-5 mx-auto mb-1" style={{ color: '#CCB300' }} />
                        <div className="text-base md:text-lg font-bold mb-0.5 break-words" style={{ color: '#CCB300' }}>9</div>
                        <div className="text-[11px] md:text-[12px] text-gray-600 break-words">Fewer Days</div>
                      </div>
                      <div className="text-center p-2 md:p-2.5 rounded-lg border min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
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
                              <div className="text-center p-2 rounded-lg border w-[110px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
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
                              <div className="text-center p-2 rounded-lg border w-[110px]" style={{ backgroundColor: 'rgba(255, 223, 0, 0.1)', borderColor: 'rgba(255, 223, 0, 0.3)' }}>
                                <IconComponent className="h-[18px] w-[18px] mx-auto mb-1" style={{ color: '#CCB300' }} />
                                <div className="text-lg font-bold mb-0.5" style={{ color: '#CCB300' }}>{kpi.value}</div>
                                <div className="text-[12px] text-gray-600">{kpi.label}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-[10px] md:text-xs text-gray-400 text-center mt-2">
                      KPIs are based on market research
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Founder Benefits */}
              <Card id="benefits" className="border-2 shadow-lg relative overflow-hidden" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.08), rgba(255, 255, 255, 0.98))' }}>
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
                    {founderBenefits.map((benefit, index) => (
                      <div key={index} className={`flex items-start gap-2 md:gap-3 ${index === 0 ? 'pt-2' : ''}`}>
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md" style={{ backgroundColor: 'rgba(255, 223, 0, 0.25)', border: '2px solid rgba(255, 223, 0, 0.4)' }}>
                          <benefit.icon className="h-4 w-4 md:h-5 md:w-5" style={{ color: '#CCB300' }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm md:text-base text-gray-900 mb-1">{benefit.title}</div>
                          <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Enterprise Customization Value Proposition */}
              <Card id="comparison" className="border-2 shadow-xl relative overflow-visible" style={{ borderColor: 'rgba(255, 223, 0, 0.4)', background: 'linear-gradient(to bottom, rgba(255, 223, 0, 0.05), rgba(255, 255, 255, 0.98))' }}>
                {/* Gold gradient overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ 
                  background: 'radial-gradient(ellipse at center, rgba(255, 223, 0, 0.1) 0%, transparent 70%)'
                }}></div>
                <CardContent className="p-3 md:p-4 lg:p-6 relative z-10 overflow-x-hidden">
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-sm md:text-base lg:text-xl mb-2 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent break-words px-2">
                      Get Enterprise-Level Customization Without the Enterprise Price Tag
                    </h3>
                    <p className="text-xs md:text-sm lg:text-base text-gray-700 font-medium break-words px-2">
                      Building a custom AI leasing solution costs hundreds of thousands. Lead2Lease delivers that same tailored experience for just <span className="font-bold text-primary">${displayPrice}/mo</span>.
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
                          <span className="flex-1 text-gray-800 font-semibold break-words">${displayPrice}/mo</span>
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
                        <div className="flex items-start gap-2 p-2 rounded min-w-0" style={{ backgroundColor: 'rgba(255, 223, 0, 0.15)' }}>
                          <span className="text-green-600 mt-0.5 font-bold flex-shrink-0">✓</span>
                          <span className="flex-1 text-gray-800 font-semibold break-words">Proven platform</span>
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
                <CardHeader className="text-white rounded-t-lg py-3 md:py-4 px-3 md:px-4 lg:px-6 relative" style={{ background: 'linear-gradient(to right, #FFDF00, #E6C900)' }}>
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
                    <span className="text-2xl md:text-3xl font-bold">${displayPrice}</span>
                    <span className="ml-1 opacity-90 text-xs md:text-sm">upfront payment</span>
                  </div>
                  <p className="text-[10px] md:text-xs mt-1 opacity-90">Monthly recurring begins post-launch</p>
                </CardHeader>
                <CardContent className="p-3 md:p-4 lg:p-6 space-y-3 md:space-y-4">
                  <div className="space-y-3 md:space-y-4">
                    <Button
                      size="lg"
                      className="w-full text-sm md:text-base py-4 md:py-5 text-white hover:opacity-90"
                      style={{ backgroundColor: '#FFDF00' }}
                      onClick={handleGetStarted}
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
        </div>
      </section>

      {/* Schedule Demo Section - Below Membership, Above FAQ */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                  Ready to Fill Your Vacancies Faster?
                </h2>
                <p className="text-sm md:text-base lg:text-lg text-foreground mb-6 md:mb-8 max-w-2xl mx-auto">
                  Join property managers who are using Lead2Lease to generate more
                  leads, book more showings, and close more leases—all while
                  reducing vacancy costs by 40%.
                </p>
                <div className="flex gap-4 flex-wrap justify-center">
                  <Link href="/book-demo">
                    <Button
                      size="lg"
                      variant="outline"
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-base md:text-lg px-6 md:px-8 py-5 md:py-6 border-2 border-blue-600 rounded-xl transition-all duration-300 font-semibold shadow-sm hover:shadow-md"
                    >
                      Schedule a Demo
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-8 md:py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8 px-2">Frequently Asked Questions</h2>
            <div className="space-y-4 md:space-y-6">
              {/* <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">What's included in the Founding Partner membership?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Everything! You get full access to all current features including AI Leasing Agent, Smart Scheduling, 
                    Multi-Channel Communication, Analytics, and all future features we build. Plus exclusive founding partner 
                    benefits like early access, priority support, and direct founder access.
                  </p>
                  <p className="text-xs md:text-sm text-gray-500 mt-2 italic">Note: All features mentioned might not be available right away.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Can I cancel anytime?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Yes, absolutely. You can cancel your subscription at any time from your account settings. 
                    You'll continue to have access until the end of your current billing period.
                  </p>
                </CardContent>
              </Card> */}
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">What payment methods do you accept?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    We accept all major credit cards and debit cards through Stripe. Your payment information 
                    is securely processed and never stored on our servers.
                  </p>
                </CardContent>
              </Card>
              {/* <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Is there a setup fee or hidden costs?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    No setup fees, no hidden costs. The ${displayPrice}/month is all you pay. All features, unlimited 
                    properties, unlimited team members, and all future updates are included.
                  </p>
                </CardContent>
              </Card> */}
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">How is pricing determined?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Design partner pricing is based on:
                  </p>
                  <ul className="text-sm md:text-base text-gray-600 mt-2 list-disc list-inside space-y-1">
                    <li>Portfolio size</li>
                    <li>Operational complexity</li>
                    <li>Required capabilities</li>
                    <li>Level of collaboration</li>
                  </ul>
                  <p className="text-sm md:text-base text-gray-600 mt-2">
                    For this reason, pricing is discussed individually rather than published publicly.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Will features configured for our business be exclusive to us?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Lead2Lease does not sell permanent feature exclusivity.
                  </p>
                  <p className="text-sm md:text-base text-gray-600 mt-2">
                    Capabilities configured or prioritized for your workflow become part of the core platform so they can be supported, improved, and maintained long-term.
                  </p>
                  <p className="text-sm md:text-base text-gray-600 mt-2">
                    This ensures reliability, upgrades, and continued innovation for all customers.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Why not offer exclusivity?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Permanent exclusivity usually requires fully custom development and long-term maintenance, which significantly increases cost and risk.
                  </p>
                  <p className="text-sm md:text-base text-gray-600 mt-2">
                    Lead2Lease provides the benefits of tailored automation — without the overhead, lock-in, or fragility of custom-built systems.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">Who is Lead2Lease best suited for?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Lead2Lease is ideal for property managers and operators who:
                  </p>
                  <ul className="text-sm md:text-base text-gray-600 mt-2 list-disc list-inside space-y-1">
                    <li>Actively manage leasing workflows</li>
                    <li>Handle consistent lead volume</li>
                    <li>Want to reduce vacancy time</li>
                    <li>Need automation without adding headcount</li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="px-4 md:px-6 pt-4 md:pt-6">
                  <CardTitle className="text-base md:text-lg">What happens if Lead2Lease isn't a fit long-term?</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    There is no obligation beyond agreed terms.
                  </p>
                  <p className="text-sm md:text-base text-gray-600 mt-2">
                    Our goal is to deliver real operational value — if the platform is not a fit, customers are not locked into long-term commitments by default.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Pricing() {
  return (
    <ThemeProvider forcedTheme="light">
      <PricingContent />
    </ThemeProvider>
  );
}

