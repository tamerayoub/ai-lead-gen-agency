// (blueprint:javascript_log_in_with_replit) Landing page for logged-out users
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Mail, Calendar, Sparkles, MessageSquare, BarChart3, CheckCircle2 } from "lucide-react";

export default function Landing() {
  const handleSignIn = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">LeaseLoopAI</span>
          </div>
          <Button onClick={handleSignIn} data-testid="button-signin-header">
            Sign In
          </Button>
        </div>
      </header>

      {/* Main Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI-Powered CRM for Property Management
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Automate lead generation, qualification, and follow-ups across email, SMS, and phone. 
            Let AI handle your property inquiries while you focus on closing deals.
          </p>
          <Button size="lg" onClick={handleSignIn} data-testid="button-signin-hero" className="text-lg px-8 py-6">
            <Sparkles className="mr-2 h-5 w-5" />
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Scale Your Property Business</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Email Automation</h3>
            <p className="text-muted-foreground">
              AI-generated replies to property inquiries with context-aware responses. 
              Approve before sending or enable auto-pilot mode.
            </p>
          </Card>

          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Calendar Integration</h3>
            <p className="text-muted-foreground">
              Sync with Google Calendar to suggest showing times automatically. 
              AI checks your availability and proposes specific dates.
            </p>
          </Card>

          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Multi-Channel Communication</h3>
            <p className="text-muted-foreground">
              Manage leads from email, SMS, and phone in one unified dashboard. 
              Full conversation history with AI activity tracking.
            </p>
          </Card>

          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Intelligent Qualification</h3>
            <p className="text-muted-foreground">
              Automatic lead scoring based on income, move-in dates, and custom criteria. 
              Focus on the most promising prospects.
            </p>
          </Card>

          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
            <p className="text-muted-foreground">
              Track conversion rates, response times, and pipeline health. 
              Real-time insights to optimize your workflow.
            </p>
          </Card>

          <Card className="p-6">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Insights</h3>
            <p className="text-muted-foreground">
              Get recommendations, automate follow-ups, and let AI handle routine tasks 
              while you maintain full control.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="max-w-3xl mx-auto p-12 bg-primary/5">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Lead Management?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join property managers who are using AI to close more deals in less time.
          </p>
          <Button size="lg" onClick={handleSignIn} data-testid="button-signin-cta" className="text-lg px-8 py-6">
            Sign In to Get Started
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 LeaseLoopAI. AI-powered property management made simple.</p>
        </div>
      </footer>
    </div>
  );
}
