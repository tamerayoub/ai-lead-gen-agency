import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/lib/appUrls";

const benefits = [
  "14-day free trial, no credit card",
  "Connect in under 5 minutes",
  "Works with any PMS",
  "Dedicated onboarding support",
];

export function CTASection() {
  return (
    <section className="relative overflow-hidden py-24" data-testid="cta-section-v3">
      <div className="absolute inset-0 bg-gradient-brand opacity-95" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "40px 40px"
      }} />

      <div className="container relative mx-auto px-6">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-white sm:text-5xl" data-testid="heading-cta-v3">
            Stop Losing Leads to Slow Follow-Up
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/80" data-testid="text-cta-description-v3">
            Join property management companies already converting more leads with Lead2Lease's AI-powered automation.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/90" data-testid={`text-cta-benefit-${i}`}>
                <CheckCircle2 className="h-4 w-4" />
                {b}
              </div>
            ))}
          </div>

          <motion.div
            className="mt-10"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link href={getRegisterUrl()}>
              <Button
                size="lg"
                className="bg-card text-primary font-bold shadow-lg"
                data-testid="button-cta-start-v3"
              >
                Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
