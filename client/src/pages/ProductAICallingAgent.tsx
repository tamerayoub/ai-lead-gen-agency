import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Phone,
  ArrowRight,
  Crown,
  CheckCircle2,
  Calendar,
  Bot,
  MessageSquare,
  Users,
  BarChart3,
  Zap,
  Shield,
  Mail,
  Bell,
  Headphones,
  Building2,
} from "lucide-react";
import { useLocation } from "wouter";

function ProductAICallingAgentContent() {
  const [, setLocation] = useLocation();

  const handleSignIn = () => {
    setLocation("/login");
  };

  const handleScrollToMembership = () => {
    setLocation("/");
    setTimeout(() => {
      const membershipSection = document.querySelector('[data-testid="section-founding-partner"]');
      if (membershipSection) {
        membershipSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200/50 sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src={logoBlack} 
              alt="Logo" 
              className="h-12 w-auto object-contain cursor-pointer"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/book-demo">
              <Button variant="outline" className="border-2">
                <Calendar className="mr-2 h-4 w-4" />
                Book a Demo
              </Button>
            </Link>
            <Button 
              onClick={handleScrollToMembership}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Become a Founding Partner
            </Button>
            <Button onClick={handleSignIn}>Sign In</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Phone className="h-5 w-5" />
            <span className="text-sm font-semibold">Coming Soon</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Phone + Inbox
          </h1>
          <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
            Never miss a call. The first phone and ticketing system designed exclusively for property management.
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Button 
              size="lg" 
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={() => setLocation("/book-demo")}
            >
              Join the Waitlist
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-2"
              onClick={() => setLocation("/book-demo")}
            >
              Schedule a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Main Problem Statement */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Your next lead is calling</h2>
            <p className="text-xl text-gray-600 mb-8">
              60% of inbound calls go unanswered. Lead2Lease Phone lets you answer from the web or on the go right from your phone. Never miss another opportunity to convert a lead.
            </p>
          </div>
        </div>
      </section>

      {/* AI Answer Assist Feature */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                  <Bot className="h-5 w-5" />
                  <span className="text-sm font-semibold">AI Answer Assist</span>
                </div>
                <h2 className="text-4xl font-bold mb-4">AI Answer Assist</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Our AI voice agent answers when your team cannot. It qualifies leads for your CRM pipeline and creates to-dos for your team. Available 24/7 to capture every opportunity.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>24/7 AI voice agent never misses a call</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Automatically qualifies leads with intelligent questions</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Creates tasks and to-dos for your team automatically</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Seamlessly integrates with your Lead2Lease CRM</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Bot className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Lead2Lease's AI Answer Assist ensures every call is answered and every lead is captured, even when your team is unavailable.</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Built for Teams Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Built for Teams</h2>
              <p className="text-xl text-gray-600">
                Unified View lets you see calls, texts and emails all in one place. So your teams have multi-channel visibility into every request.
              </p>
            </div>

            {/* Unified View Feature */}
            <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <MessageSquare className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Unified View</p>
              </Card>
              <div className="order-1 md:order-2">
                <h3 className="text-3xl font-bold mb-4">Unified View</h3>
                <p className="text-lg text-gray-600 mb-6">
                  Track every call, text, and email in a single conversation timeline so anyone can pick up where the last teammate left off. Complete context in one place.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>All communications in one timeline</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Team members can seamlessly hand off conversations</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Complete conversation history at a glance</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8">
                <Users className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Call Routing</h3>
                <p className="text-gray-600 mb-4">
                  Build call flows that route residents, owners, and prospects to the right specialist or queue based on your business hours. Ensure every caller reaches the right person.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Smart routing based on caller type and time</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Customizable call flows for your business</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <MessageSquare className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">SMS/MMS</h3>
                <p className="text-gray-600 mb-4">
                  Send and receive two-way texting—including photos and videos—from dedicated local numbers inside the same shared inbox. Text leads directly from Lead2Lease.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Two-way SMS and MMS messaging</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Dedicated local phone numbers</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Team Metrics</h3>
                <p className="text-gray-600 mb-4">
                  Monitor response times, missed calls, and workload by rep so you can coach the team and protect service-level agreements. Data-driven team management.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Real-time performance dashboards</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Track response times and call quality</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Integrates with CRM</h3>
                <p className="text-gray-600 mb-4">
                  Automatically log every interaction to the Lead2Lease CRM and trigger workflows without double entry or data gaps. Seamless integration with your existing pipeline.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Automatic call logging and lead creation</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Trigger workflows from phone interactions</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <Headphones className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Call Tree</h3>
                <p className="text-gray-600 mb-4">
                  Design multi-level menus for emergencies, leasing, and maintenance so callers always reach a live resource or voicemail. Professional phone system for property management.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Customizable IVR menus</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Route to appropriate departments automatically</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <Building2 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Answer from Anywhere</h3>
                <p className="text-gray-600 mb-4">
                  Answer calls from your web browser, mobile app, or desk phone. Your team can work from anywhere while maintaining professional phone presence.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Web-based phone system</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Mobile app for on-the-go answering</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Grow your portfolio with confidence</h2>
            <p className="text-xl text-gray-600 mb-8">
              Join the waitlist to be among the first to experience Lead2Lease Phone + Inbox. Never miss a call, never miss a lead.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                onClick={() => setLocation("/book-demo")}
              >
                Join the Waitlist
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-2"
                onClick={() => setLocation("/book-demo")}
              >
                Schedule a Demo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProductAICallingAgent() {
  return (
    <ThemeProvider forcedTheme="light">
      <ProductAICallingAgentContent />
    </ThemeProvider>
  );
}

