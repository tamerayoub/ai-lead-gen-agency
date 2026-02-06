import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getRegisterUrl } from "@/lib/appUrls";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero pt-32 pb-20" data-testid="hero-section-v3">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(hsl(217 91% 50%) 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      }} />

      <div className="container relative mx-auto px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground" data-testid="badge-hero-v3">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              AI-Powered Property Management CRM
            </span>
          </motion.div>

          <motion.h1
            className="mt-6 text-5xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            data-testid="heading-hero-v3"
          >
            Turn Every Inquiry
            <br />
            <span className="text-gradient-brand">Into Your Leasing Pipeline</span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            data-testid="text-hero-description-v3"
          >
            Automatically capture leads, qualify prospects, and manage your entire rental pipeline 
            from initial contact to signed lease. Never lose a lead again.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href={getRegisterUrl()}>
              <Button size="lg" className="bg-gradient-brand shadow-brand" data-testid="button-hero-start-v3">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" data-testid="button-hero-demo-v3">
              <Play className="mr-2 h-5 w-5" /> Watch Demo
            </Button>
          </motion.div>

          <motion.p
            className="mt-4 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            data-testid="text-hero-subtext-v3"
          >
            No credit card required · 14-day free trial · Setup in under 5 minutes
          </motion.p>
        </div>
      </div>
    </section>
  );
}
