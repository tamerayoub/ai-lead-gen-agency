import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Calendar,
  ArrowRight,
  Crown,
  CheckCircle2,
  Clock,
  Users,
  MapPin,
  Building2,
  Bell,
  Zap,
  Shield,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function ProductSchedulingContent() {
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
            <Calendar className="h-5 w-5" />
            <span className="text-sm font-semibold">Scheduling</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI-Powered Scheduling That Knows Your Team
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Effortlessly manage tours with AI that understands your team's schedule and streamlines bookings to save time and boost efficiency
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
              <div className="text-5xl font-bold text-primary mb-2">113%</div>
              <div className="text-lg text-gray-600">Increase in Appointments Set</div>
            </Card>
            <Card className="text-center p-8">
              <div className="text-5xl font-bold text-primary mb-2">62%</div>
              <div className="text-lg text-gray-600">Increase in Tours Year Over Year</div>
            </Card>
            <Card className="text-center p-8">
              <div className="text-5xl font-bold text-primary mb-2">150%</div>
              <div className="text-lg text-gray-600">Faster Time to Tour</div>
            </Card>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            KPIs are based on market research
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-16">
            {/* Feature 1: Calendar Sync */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-4">One Calendar, No Chaos</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Sync all your Microsoft and Google calendars to Lead2Lease. Get showings booked only during available times in your personal or work calendars. No more double-bookings or scheduling conflicts.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Real-time calendar synchronization</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Automatic conflict detection and prevention</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Two-way sync keeps everything in sync</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Calendar className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Lead2Lease's calendar synchronization ensures your schedule is always up-to-date across all platforms</p>
              </Card>
            </div>

            {/* Feature 2: Back-to-Back Showings */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <Zap className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">One Trip, Multiple Showings</p>
              </Card>
              <div className="order-1 md:order-2">
                <h2 className="text-4xl font-bold mb-4">One Trip, Multiple Showings</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Book back-to-back showings for a single property with just one toggle. Show up once and do all the showings in one go. Maximize your time and minimize travel.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Batch multiple showings in one time slot</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Reduce travel time and fuel costs</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Streamline your showing schedule</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Feature 3: Group Showings */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-4">Host Group Showings to Save Time and Fuel</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Use group showings to combine multiple prospects into a single time slot, letting you save on travel time and fuel costs with just one trip. Perfect for high-demand properties.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Combine multiple prospects in one showing</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Reduce travel and maximize efficiency</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Perfect for popular listings</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                <Users className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Lead2Lease's group showing feature helps you manage multiple prospects efficiently</p>
              </Card>
            </div>

            {/* Feature 4: Travel Buffers */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 order-2 md:order-1">
                <MapPin className="h-16 w-16 text-primary mb-4" />
                <p className="text-gray-600">Add Travel Buffers for Agents to Catch their Breath</p>
              </Card>
              <div className="order-1 md:order-2">
                <h2 className="text-4xl font-bold mb-4">Add Travel Buffers for Agents to Catch their Breath</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Automatically schedule enough time for leasing agents with our 'Travel Time Buffer' to get from one property showing to the next. No more rushing between appointments.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Automatic buffer time calculation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Customizable buffer times per property</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>Prevents agent burnout and scheduling stress</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">More Ways We Simplify Scheduling</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8">
                <Building2 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Open House Scheduler</h3>
                <p className="text-gray-600 mb-4">
                  Lead2Lease lets you create Open House slots, automatically marking those time slots as busy to prevent other showings from overlapping. Perfect for showcasing properties to multiple prospects at once.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Block out time slots for open houses</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Prevent scheduling conflicts automatically</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <Users className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Assign Multiple Agents to On-Market Units</h3>
                <p className="text-gray-600 mb-4">
                  Assign multiple backup agents to each on-market unit, ensuring showings continue even if your primary agent is unavailable. Never miss a showing opportunity.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Set primary and backup agents</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Automatic fallback to available agents</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Equally Auto-Distribute Showings</h3>
                <p className="text-gray-600 mb-4">
                  Maximize showings while preventing burnout by auto-assigning tours evenly to available agents. Balance the workload across your team automatically.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Fair distribution of showing assignments</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Prevent agent overload</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-8">
                <Bell className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Notify Tenants about Booked Showings</h3>
                <p className="text-gray-600 mb-4">
                  Automatically notify current tenants when a showing is booked, reducing the need for constant communication. Keep everyone informed without the hassle.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Automatic tenant notifications</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Reduce communication overhead</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>How does the payment cycle work? Do you offer trials and refunds?</AccordionTrigger>
                <AccordionContent>
                  Lead2Lease offers flexible payment options with monthly subscriptions. We provide a 14-day free trial for new users to explore all features. Refunds are available within the first 30 days if you're not satisfied. Contact our support team for more details.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>How do you keep track of all your showings?</AccordionTrigger>
                <AccordionContent>
                  Lead2Lease automatically tracks all showings in a centralized calendar system. Every showing is logged with details including date, time, property, lead information, and agent assignments. You can view all showings in the Schedule dashboard, filter by date range, property, or agent, and export reports for your records.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Are all these Scheduling features available in the basic plan?</AccordionTrigger>
                <AccordionContent>
                  Yes! All scheduling features including calendar sync, group showings, travel buffers, open house scheduling, and agent assignment are included in our Founding Partner membership. There are no feature limitations - you get access to everything.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Does Lead2Lease integrate with Zapier?</AccordionTrigger>
                <AccordionContent>
                  Currently, Lead2Lease integrates directly with Google Calendar, Microsoft Outlook, and major property management platforms. Zapier integration is on our roadmap and will be available soon. Contact us if you need a specific integration.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>What if a property is rented but showings are still scheduled?</AccordionTrigger>
                <AccordionContent>
                  Lead2Lease automatically cancels all future showings when you mark a property as rented. You can also manually cancel individual showings or bulk cancel all showings for a property. The system will automatically notify all booked prospects about the cancellation.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Shield className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-4">Keep your leasing team happy and organized</h2>
            <p className="text-xl text-gray-600 mb-8">
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

export default function ProductScheduling() {
  return (
    <ThemeProvider forcedTheme="light">
      <ProductSchedulingContent />
    </ThemeProvider>
  );
}
