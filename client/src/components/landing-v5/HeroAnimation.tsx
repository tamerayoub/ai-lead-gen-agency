import { motion } from 'framer-motion';
import { FacebookMarketplacePanel } from './FacebookMarketplacePanel';
import { CRMWorkflowPanel } from './CRMWorkflowPanel';
import { DataFlowBridge } from './DataFlowBridge';
import { MobileFlowAnimation } from './MobileFlowAnimation';

export const HeroAnimation = () => {
  return (
    <motion.div 
      className="relative w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      data-testid="hero-animation-v5"
    >
      {/* Mobile: simplified icon-based flow - FB logo | flowing data | Your Workflow */}
      <div className="lg:hidden flex justify-center py-4">
        <MobileFlowAnimation />
      </div>

      {/* Desktop: scaled down to fit viewport without scrolling */}
      <div className="hidden lg:block relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className="relative grid grid-cols-[minmax(260px,0.9fr)_minmax(120px,160px)_minmax(260px,0.9fr)] gap-4 items-stretch min-h-[360px] xl:min-h-[400px] w-full max-w-[1200px] ml-0 origin-center scale-[0.7] xl:scale-[0.78]">
          <div className="min-w-0 flex flex-col">
            <FacebookMarketplacePanel />
          </div>
          <div className="min-w-0 flex items-center">
            <DataFlowBridge />
          </div>
          <div className="min-w-0 flex flex-col">
            <CRMWorkflowPanel />
          </div>
        </div>
      </div>

      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none hidden lg:block" />
    </motion.div>
  );
};
