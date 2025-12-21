import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Bot,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Shield,
  MessageSquare,
  FileText,
  Users,
  Brain,
  Phone,
  Mail,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";

function ProductAIAgentContent() {
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
            <Bot className="h-5 w-5" />
            <span className="text-sm font-semibold">AI Agent</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Custom-Built for Property Managers
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            From guest cards to signing a lease, the entire cycle of leasing cut down by 90% with 1/4th the operational costs
          </p>
          <Button 
            size="lg" 
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            onClick={() => setLocation("/book-demo")}
          >
            Book a Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8">
              <div className="text-5xl font-bold text-primary mb-2">40%</div>
              <div className="text-lg text-gray-600">More Lead-to-Lease Conversions</div>
            </Card>
            <Card className="text-center p-8">
              <div className="text-5xl font-bold text-primary mb-2">86%</div>
              <div className="text-lg text-gray-600">Inquiries Handled by AI + Automation</div>
            </Card>
            <Card className="text-center p-8">
              <div className="text-5xl font-bold text-primary mb-2">69%</div>
              <div className="text-lg text-gray-600">Tours Booked After Hours</div>
            </Card>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            KPIs are based on market research
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">LetHub's Self Showing Lockbox Property Management</h2>
                <p className="text-gray-600 mb-4">
                  Lead2Lease's auto response to leads from multiple sources ensures you never miss an opportunity.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Automated lead capture from all channels</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Instant response to inquiries</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Bot className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <Shield className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Avoid Costly No-Shows</p>
              </Card>
              <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold mb-4">Avoid Costly No-Shows</h2>
                <p className="text-gray-600 mb-4">
                  Lead2Lease allows prospects to choose and confirm their preferred tour times, reducing no-shows and keeping your calendar full
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Smart scheduling with conflict detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Automated reminders to reduce no-shows</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Embed on Website To Book Tours</h2>
                <p className="text-gray-600 mb-4">
                  Lead2Lease converts your listing site visitors into qualified and nurtured leads
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Easy website integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Seamless booking experience</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Calendar className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
            </div>

            {/* Feature 4 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <MessageSquare className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Auto-Save Lead Conversations</p>
              </Card>
              <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold mb-4">Auto-Save Lead Conversations</h2>
                <p className="text-gray-600 mb-4">
                  Activity log stores all lead communication for easy tracking and review
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Complete conversation history</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Easy search and review</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Send Rental Application Links</h2>
                <p className="text-gray-600 mb-4">
                  Skip paperwork with auto-sent custom rental applications
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Automated application delivery</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Customizable application forms</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <FileText className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
            </div>

            {/* Feature 6 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <Users className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Pre-qualify Potential Renters with AI</p>
              </Card>
              <div className="order-1 md:order-2">
                <h2 className="text-3xl font-bold mb-4">Pre-qualify Potential Renters with AI</h2>
                <p className="text-gray-600 mb-4">
                  Lead2Lease asks pre-qualification questions, ensuring only qualified leads can book tours.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Customizable qualification questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Automatic filtering of unqualified leads</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 7 */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Safe from Squatters and Scammers</h2>
                <p className="text-gray-600 mb-4">
                  Auto-confirm booked tours once lead screening is completed
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Identity verification before access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>Secure showing management</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Shield className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Latest AI Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Latest AI Features</h2>
              <p className="text-xl text-gray-600">Invite Only</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8">
                <Brain className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">AI-Powered Personal Assistant</h3>
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
              <Card className="p-8">
                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Talk to Your Data with AI</h3>
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
              <Card className="p-8">
                <Phone className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">AI-Powered Call Centre Agents</h3>
                <p className="text-gray-600">LetHub's auto response to leads from multiple sources</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Proven Results</h2>
              <p className="text-xl text-gray-600">See how AI automation transforms leasing operations</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8 text-center">
                <div className="text-4xl font-bold text-primary mb-2">50%</div>
                <div className="text-lg text-gray-600">Higher Compensation for Leasing Teams</div>
              </Card>
              <Card className="p-8 text-center">
                <div className="text-4xl font-bold text-primary mb-2">33%</div>
                <div className="text-lg text-gray-600">Higher Lease Conversion at Centralized Communities</div>
              </Card>
              <Card className="p-8 text-center">
                <div className="text-4xl font-bold text-primary mb-2">15</div>
                <div className="text-lg text-gray-600">Weekday Hours Saved Per Week</div>
              </Card>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              KPIs are based on market research
            </p>
          </div>
        </div>
      </section>

      {/* Answer Queries Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Mail className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-4">Answer Renter Queries On Email and SMS</h2>
            <p className="text-xl text-gray-600 mb-8">
              Keep your leasing team happy and organized
            </p>
            <p className="text-lg text-gray-600 mb-8">
              Learn how Lead2Lease can cut down vacancy while maintaining a human touch.
            </p>
            <Button 
              size="lg" 
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={() => setLocation("/book-demo")}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProductAIAgent() {
  return (
    <ThemeProvider forcedTheme="light">
      <ProductAIAgentContent />
    </ThemeProvider>
  );
}

