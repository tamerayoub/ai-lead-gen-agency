import { useEffect } from 'react';
import '../landing-v5.css';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { getLoginUrl, getRegisterUrl } from '@/lib/appUrls';
import { ensureAcquisitionContextFromLanding } from '@/lib/acquisition';
import { HeroAnimation } from '@/components/landing-v5/HeroAnimation';
import { HeroCTA } from '@/components/landing-v5/HeroCTA';
import { ArrowRight, BarChart3, Plug } from 'lucide-react';
import logoBlack from '@/assets/lead2lease-logo-black.svg';

export default function LandingV5() {
  useEffect(() => {
    ensureAcquisitionContextFromLanding();
  }, []);
  return (
    <div className="landing-v5 min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground text-center py-2.5 px-4 text-xs sm:text-sm font-medium leading-tight break-words" data-testid="banner-top-v5">
        The only Facebook Marketplace integration for rental properties available in the market!
      </div>
      <nav className="fixed top-9 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl" data-testid="navbar-v5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" data-testid="link-logo-v5">
              <img
                src={logoBlack}
                alt="Lead2Lease"
                className="h-8 w-auto object-contain"
              />
            </Link>

            <div className="hidden md:flex items-center gap-6" data-testid="nav-links-v5">
              <Link href="/book-demo" className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md">
                Book Demo
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href={getRegisterUrl()}>
                <Button variant="outline" size="sm" className="border-border" data-testid="button-header-login-v5">
                  Log In
                </Button>
              </Link>
              <Link href={getRegisterUrl()}>
                <Button size="sm" className="lv5-bg-gradient-primary text-white" data-testid="button-header-cta-v5">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[calc(100vh-5.5rem)] pt-24 pb-6 lg:pt-28 lg:pb-8 overflow-hidden flex flex-col justify-center" data-testid="hero-section-v5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-1/3 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-14 xl:gap-16">
            <div className="flex-shrink-0 w-full lg:w-[380px] xl:w-[420px] lg:min-h-0 lg:pr-4">
              <HeroCTA />
            </div>

            <div className="flex-1 w-full min-w-0 mt-6 lg:mt-0 lg:pl-4 xl:pl-6 flex items-center overflow-visible">
              <HeroAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* 70% of renters use Facebook stat section */}
      <section className="relative py-12 lg:py-16 border-t border-border/30 bg-secondary/30" data-testid="facebook-stat-section-v5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl lv5-bg-gradient-primary mb-6">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="heading-facebook-stat-v5">
            <span className="lv5-text-gradient-primary">70%</span> of renters use Facebook as their main source to find properties
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-facebook-stat-description-v5">
            Don&apos;t miss out on the largest rental audience. Lead2Lease connects your Facebook Marketplace listings directly to your leasing workflow so you capture every lead where they&apos;re already looking.
          </p>
        </div>
      </section>

      <section className="relative py-16 lg:py-24 border-t border-border/30" data-testid="features-section-v5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="heading-features-v5">
              Everything syncs.{' '}
              <span className="lv5-text-gradient-primary">Nothing falls through the cracks.</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description-v5">
              lead2lease connects your Facebook Marketplace listings and conversations directly to your leasing workflow, 
              so every lead is captured, tracked, and followed up on automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-border/50 hover-elevate" data-testid="feature-lead-capture-v5">
              <div className="w-12 h-12 rounded-xl lv5-bg-gradient-primary flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Automatic Lead Capture</h3>
              <p className="text-sm text-muted-foreground">
                Every Facebook Marketplace inquiry automatically creates a lead profile in your CRM with full conversation history.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/50 hover-elevate" data-testid="feature-bidirectional-sync-v5">
              <div className="w-12 h-12 rounded-xl lv5-bg-gradient-primary flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Bidirectional Sync</h3>
              <p className="text-sm text-muted-foreground">
                Reply from your CRM and it appears on Facebook. Schedule tours, send applications, and manage everything in one place.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/50 hover-elevate" data-testid="feature-ai-responses-v5">
              <div className="w-12 h-12 rounded-xl lv5-bg-gradient-primary flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  <path d="M20.24 7.24A6 6 0 0 0 14 2v6h6a6 6 0 0 0-.76-1.76" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">AI-Powered Responses</h3>
              <p className="text-sm text-muted-foreground">
                Our AI responds instantly to common questions, qualifies leads, and schedules showings while you focus on closing deals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API / PMS integration section - no animation */}
      <section className="relative py-16 lg:py-24 border-t border-border/30 bg-secondary/20" data-testid="api-integration-section-v5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl lv5-bg-gradient-primary mb-4">
              <Plug className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="heading-api-integration-v5">
              Integrates with your existing <span className="lv5-text-gradient-primary">systems & tools</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-api-integration-description-v5">
              Connect Lead2Lease to your existing systems and workflow tools using our API. Sync leads, listings, and conversations—or build custom integrations.
            </p>
          </div>
        </div>
      </section>

      <section className="relative py-16 lg:py-24 border-t border-border/30" data-testid="cta-section-v5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="heading-bottom-cta-v5">
            Ready to stop losing leads?
          </h2>
          <p className="text-muted-foreground mb-8" data-testid="text-bottom-cta-description-v5">
            Connect your Facebook Marketplace account in under 5 minutes and start converting more leads into signed leases today.
          </p>
          <Link href={getRegisterUrl()}>
            <Button size="lg" className="group lv5-bg-gradient-primary text-white shadow-lg" data-testid="button-bottom-cta-v5">
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4" data-testid="text-bottom-subtext-v5">
            No credit card required &middot; Cancel anytime
          </p>
        </div>
      </section>

      <footer className="border-t border-border/30 py-12 px-4 sm:px-6 lg:px-8" data-testid="footer-v5">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-8">
            <Link href="/" data-testid="link-footer-logo-v5">
              <img src={logoBlack} alt="Lead2Lease" className="h-8 w-auto object-contain" />
            </Link>
          </div>
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground">Faster leasing starts here.</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-semibold text-foreground mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={getLoginUrl()} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-login-v5">Login</Link>
                </li>
                <li>
                  <Link href={getRegisterUrl()} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-signup-v5">Sign Up</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/book-demo" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-book-demo-v5">Book Demo</Link>
                </li>
                <li>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-help-v5">Help</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-support-v5">Support</a>
                </li>
                <li>
                  <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms-v5">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/privacy-notice" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy-v5">Privacy Notice</Link>
                </li>
                <li>
                  <Link href="/cookies-policy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-cookies-v5">Cookies Policy</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contact Info</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <a href="mailto:support@lead2lease.ai" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-email-v5">support@lead2lease.ai</a>
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-border/30 pt-8 text-center text-sm">
            <p className="text-muted-foreground" data-testid="text-footer-copyright-v5">
              Lead2Lease is an AI-powered leasing technology platform. | Copyright © {new Date().getFullYear()} Lead2Lease. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
