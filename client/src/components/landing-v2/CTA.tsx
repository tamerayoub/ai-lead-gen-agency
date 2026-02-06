import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

const benefits = [
  "Free to start, no credit card required",
  "Connect in under 2 minutes",
  "See your leads instantly",
  "Cancel anytime",
];

export function CTA() {
  return (
    <section className="py-20 lg:py-32 bg-hero-gradient relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary-foreground rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 text-center">
        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6 max-w-3xl mx-auto">
          Ready to Never Miss Another Lead?
        </h2>
        <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
          Join thousands of marketplace sellers who capture, organize, and close more deals with Lead2Lease.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/register">
            <Button variant="hero" size="xl" className="group bg-accent-gradient" data-testid="button-cta-trial">
              Start Free Trial
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/book-demo">
            <Button variant="heroOutline" size="xl" className="border-primary-foreground/20 text-primary-foreground backdrop-blur-sm" data-testid="button-cta-demo">
              Schedule Demo
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 text-primary-foreground/90">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-accent-foreground" />
              </div>
              <span className="text-sm font-medium">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
