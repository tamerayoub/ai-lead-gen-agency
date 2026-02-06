import { useEffect } from "react";
import "../landing-v4.css";
import { Gauge, CalendarClock, Rocket, Send, Target } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AnimatedChatDemo } from "@/components/landing-v4/AnimatedChatDemo";
import { FacebookBadge } from "@/components/landing-v4/FacebookBadge";
import { StatCard } from "@/components/landing-v4/StatCard";
import { Logo } from "@/components/landing-v4/Logo";
import { getLoginUrl, getRegisterUrl } from "@/lib/appUrls";
import { ensureAcquisitionContextFromLanding } from "@/lib/acquisition";
import { ArrowRight } from "lucide-react";

function FeatureCard({
  icon,
  title,
  description,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  testId?: string;
}) {
  return (
    <div className="p-8 bg-card border border-border rounded-2xl hover-elevate" data-testid={testId}>
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground" data-testid={testId ? `${testId}-title` : undefined}>{title}</h3>
      <p className="text-muted-foreground" data-testid={testId ? `${testId}-desc` : undefined}>{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  testId,
}: {
  number: string;
  title: string;
  description: string;
  testId?: string;
}) {
  return (
    <div className="text-center" data-testid={testId}>
      <div className="w-16 h-16 rounded-full lv4-gradient-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-6 lv4-glow-primary">
        {number}
      </div>
      <h3 className="text-xl font-bold mb-2 text-foreground" data-testid={testId ? `${testId}-title` : undefined}>{title}</h3>
      <p className="text-muted-foreground" data-testid={testId ? `${testId}-desc` : undefined}>{description}</p>
    </div>
  );
}

export default function LandingV4() {
  useEffect(() => {
    ensureAcquisitionContextFromLanding();
  }, []);
  return (
    <div className="landing-v4 min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border" data-testid="navbar-v4">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/book-demo">
              <Button variant="ghost" className="rounded-full" data-testid="button-header-book-demo-v4">
                Book a Demo
              </Button>
            </Link>
            <Link href={getRegisterUrl()}>
              <Button className="lv4-gradient-primary text-primary-foreground lv4-glow-primary rounded-full" data-testid="button-header-cta-v4">
                Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-20 px-6" data-testid="hero-section-v4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div className="inline-block">
                <FacebookBadge />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground" data-testid="heading-hero-v4">
                  Your AI Leasing Agent
                  <span className="block lv4-text-gradient">Never Sleeps</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg" data-testid="text-hero-description-v4">
                  Automatically respond to Facebook Marketplace leads, answer questions,
                  and book property tours — 24/7, without lifting a finger.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  value="< 30s"
                  label="Response Time"
                  icon={<Gauge className="w-6 h-6" />}
                  testId="stat-response-time"
                />
                <StatCard
                  value="3x"
                  label="More Tours Booked"
                  icon={<Rocket className="w-6 h-6" />}
                  testId="stat-tours-booked"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href={getRegisterUrl()}>
                  <Button size="lg" className="lv4-gradient-primary text-primary-foreground lv4-glow-primary rounded-full text-lg px-8 py-6 h-auto" data-testid="button-hero-cta-v4">
                    Start Automating Now for free <ArrowRight className="ml-2 w-6 h-6" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-4 pt-2" data-testid="social-proof-v4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground"
                      data-testid={`avatar-social-proof-${i}`}
                    >
                      {["JM", "SK", "AR", "LP"][i - 1]}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  Trusted by <span className="font-semibold text-foreground">500+</span> property managers
                </span>
              </div>
            </div>

            <div className="relative lg:sticky lg:top-24">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 blur-3xl opacity-50 rounded-3xl" />
              <div className="relative lv4-animate-float">
                <AnimatedChatDemo />
              </div>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-border" data-testid="features-section-v4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground" data-testid="heading-features-v4">
              Why Property Managers Love <span className="lv4-text-gradient">lead2lease</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description-v4">
              Turn Facebook Marketplace into your #1 leasing channel
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Send className="w-8 h-8" />}
              title="Instant Responses"
              description="Never miss a lead. Our AI responds to inquiries in under 30 seconds, 24/7."
              testId="feature-instant-responses"
            />
            <FeatureCard
              icon={<CalendarClock className="w-8 h-8" />}
              title="Automated Scheduling"
              description="AI books tours directly into your calendar. No back-and-forth needed."
              testId="feature-scheduling"
            />
            <FeatureCard
              icon={<Target className="w-8 h-8" />}
              title="Higher Conversion"
              description="Convert 3x more leads into tours with instant, intelligent follow-up."
              testId="feature-conversion"
            />
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-card/50" data-testid="how-it-works-section-v4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground" data-testid="heading-how-it-works-v4">
              Set Up in <span className="lv4-text-gradient">5 Minutes</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number="1"
              title="Connect Facebook"
              description="Link your Facebook Marketplace listings in one click"
              testId="step-1"
            />
            <StepCard
              number="2"
              title="Set Your Preferences"
              description="Tell us your properties, pricing, and tour availability"
              testId="step-2"
            />
            <StepCard
              number="3"
              title="Let AI Work"
              description="Watch tours get booked while you focus on closings"
              testId="step-3"
            />
          </div>

          <div className="text-center mt-16">
            <Link href={getRegisterUrl()}>
              <Button size="lg" className="lv4-gradient-primary text-primary-foreground lv4-glow-primary rounded-full" data-testid="button-bottom-cta-v4">
                Start Your Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground" data-testid="text-bottom-subtext-v4">
              No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-border" data-testid="footer-v4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground">
              Faster leasing starts here.
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-semibold text-foreground mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={getLoginUrl()} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-login-v4">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href={getRegisterUrl()} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-signup-v4">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/book-demo" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-book-demo-v4">
                    Book Demo
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-help-v4">
                    Help
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-support-v4">
                    Support
                  </a>
                </li>
                <li>
                  <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms-v4">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-notice" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy-v4">
                    Privacy Notice
                  </Link>
                </li>
                <li>
                  <Link href="/cookies-policy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-cookies-v4">
                    Cookies Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contact Info</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-email-v4">
                    support@lead2lease.ai
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm">
            <p className="text-muted-foreground" data-testid="text-footer-copyright-v4">
              Lead2Lease is an AI-powered leasing technology platform. | Copyright © {new Date().getFullYear()} Lead2Lease. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
