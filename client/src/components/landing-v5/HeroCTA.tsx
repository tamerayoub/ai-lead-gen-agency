import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { getRegisterUrl } from '@/lib/appUrls';

export const HeroCTA = () => {
  return (
    <motion.div 
      className="relative z-10 text-center lg:text-left max-w-lg lg:max-w-none overflow-visible"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      data-testid="hero-cta-v5"
    >
      <motion.div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border mb-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        data-testid="badge-realtime-sync-v5"
      >
        <span className="w-2 h-2 rounded-full lv5-bg-success lv5-animate-pulse" />
        <span className="text-xs font-medium text-foreground">Now with real-time sync</span>
      </motion.div>

      <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-bold text-foreground leading-tight mb-3" data-testid="heading-hero-v5">
        Turn Facebook Marketplace Leads Into{' '}
        <span className="lv5-text-gradient-primary">Signed Leases</span>
        {' '}&mdash; Automatically
      </h1>

      <p className="text-base text-muted-foreground mb-5 leading-relaxed" data-testid="text-hero-description-v5">
        Sync Facebook Marketplace leads, listings, and conversations directly into your leasing workflow.{' '}
        <span className="text-foreground font-medium">Never lose a lead again.</span>
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 mb-4 px-6 sm:px-0">
        <Link href={getRegisterUrl()} className="w-full sm:w-auto">
          <Button 
            size="lg" 
            className="w-full sm:w-auto lv5-bg-gradient-primary text-white shadow-lg text-sm sm:text-lg px-6 py-5 sm:py-6 whitespace-normal text-center sm:whitespace-nowrap sm:text-left break-words min-w-0"
            data-testid="button-hero-primary-cta-v5"
          >
            Connect Facebook Marketplace Now for Free
            <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1 text-sm text-muted-foreground" data-testid="checklist-hero-v5">
        <span className="flex items-center gap-1.5">
          <Check className="w-4 h-4 lv5-text-success" />
          Start free
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="w-4 h-4 lv5-text-success" />
          No credit card
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="w-4 h-4 lv5-text-success" />
          5-minute setup
        </span>
      </div>
    </motion.div>
  );
};
