import { motion, AnimatePresence } from 'framer-motion';
import { User, MessageCircle, Home, Send, Calendar, FileText, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

const FacebookLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="20" fill="#1877F2"/>
    <path 
      d="M27.785 25.781L28.672 20H23.125V16.25C23.125 14.797 23.836 13.375 26.117 13.375H28.875V8.359C28.875 8.359 26.32 7.875 23.879 7.875C18.772 7.875 15.312 11.083 15.312 16.688V20H10.203V25.781H15.312V38.719C16.335 38.875 17.379 39 18.438 39C19.496 39 20.54 38.875 21.562 38.719V25.781H27.785Z" 
      fill="white"
    />
  </svg>
);

const incomingIcons = [
  { id: 'lead', icon: User, color: 'lv5-flow-accent-primary', label: 'Lead' },
  { id: 'message', icon: MessageCircle, color: 'lv5-flow-facebook', label: 'Message' },
  { id: 'listing', icon: Home, color: 'lv5-flow-primary-accent', label: 'Listing' },
];

const outgoingIcons = [
  { id: 'reply', icon: Send, color: 'lv5-flow-success-primary', label: 'Reply' },
  { id: 'tour', icon: Calendar, color: 'lv5-flow-primary-facebook', label: 'Tour' },
  { id: 'app', icon: FileText, color: 'lv5-flow-accent-success', label: 'Application' },
];

const MobileFlowingIcon = ({ 
  icon: Icon, 
  colorClass, 
  label,
  delay, 
  yOffset, 
  direction 
}: { 
  icon: typeof User; 
  colorClass: string; 
  label: string;
  delay: number; 
  yOffset: number; 
  direction: 'left-to-right' | 'right-to-left';
}) => {
  const isLeftToRight = direction === 'left-to-right';
  return (
    <motion.div
      className={`absolute flex flex-col items-center gap-0.5 ${isLeftToRight ? 'left-0' : 'right-0'}`}
      style={{ top: `${yOffset}%` }}
      initial={{ 
        x: isLeftToRight ? '-100%' : '100%',
        opacity: 0,
        scale: 0.6,
      }}
      animate={{ 
        x: isLeftToRight ? ['0%', '400%'] : ['0%', '-400%'],
        opacity: [0, 1, 1, 0],
        scale: [0.6, 1, 1, 0.6],
      }}
      transition={{
        duration: 3.5,
        delay,
        repeat: Infinity,
        repeatDelay: 6,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <div className={`w-9 h-9 rounded-full ${colorClass} lv5-data-particle flex items-center justify-center shadow-md`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">{label}</span>
    </motion.div>
  );
};

const MobileFlowCenter = () => {
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setShowSync(true);
      setTimeout(() => setShowSync(false), 1800);
    }, 5500);
    setTimeout(() => {
      setShowSync(true);
      setTimeout(() => setShowSync(false), 1800);
    }, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative w-full h-[240px] flex items-center justify-center overflow-hidden min-w-[80px]" data-testid="mobile-flow-center-v5">
      {/* Flow lines */}
      <div className="absolute inset-0 flex flex-col justify-center gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative h-0.5 w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/50 to-transparent"
              animate={{ x: i % 2 === 0 ? ['-100%', '100%'] : ['100%', '-100%'] }}
              transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ))}
      </div>

      {/* Incoming icons (FB -> CRM) */}
      {incomingIcons.map((item, i) => (
        <MobileFlowingIcon
          key={item.id}
          icon={item.icon}
          colorClass={item.color}
          label={item.label}
          delay={i * 2.5}
          yOffset={10 + i * 20}
          direction="left-to-right"
        />
      ))}

      {/* Outgoing icons (CRM -> FB) */}
      {outgoingIcons.map((item, i) => (
        <MobileFlowingIcon
          key={item.id}
          icon={item.icon}
          colorClass={item.color}
          label={item.label}
          delay={1.2 + i * 2.5}
          yOffset={55 + i * 22}
          direction="right-to-left"
        />
      ))}

      <AnimatePresence>
        {showSync && (
          <motion.div
            className="absolute z-10 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.25 }}
          >
            <div className="lv5-integration-badge p-2 rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </motion.div>
            </div>
            <p className="text-[10px] font-semibold text-primary mt-1">Sync</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MobileFlowAnimation = () => {
  return (
    <motion.div
      className="flex items-center justify-between gap-2 px-4 py-6 w-full max-w-md mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      data-testid="mobile-flow-animation-v5"
    >
      {/* Left: Facebook logo */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-14 h-14 rounded-2xl lv5-shadow-card border border-border/50 flex items-center justify-center bg-white">
          <FacebookLogo className="w-9 h-9" />
        </div>
        <p className="text-[10px] font-medium text-muted-foreground text-center">Marketplace</p>
      </div>

      {/* Center: Flow animation - overflow hidden to keep icons within path */}
      <div className="flex-1 min-w-0 flex justify-center overflow-hidden">
        <MobileFlowCenter />
      </div>

      {/* Right: Your Workflow */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-14 h-14 rounded-2xl lv5-bg-gradient-primary lv5-shadow-card border border-border/30 flex items-center justify-center">
          <Home className="w-7 h-7 text-white" />
        </div>
        <p className="text-[10px] font-medium text-muted-foreground text-center leading-tight">Your Workflow</p>
      </div>
    </motion.div>
  );
};
