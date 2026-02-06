import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, User, MessageCircle, Home, Clock, Send, Calendar, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

const incomingDataTypes = [
  { id: 'lead', label: 'New Lead', sublabel: 'Sarah M. \u2022 Just now', icon: User, color: 'lv5-flow-accent-primary' },
  { id: 'message-in', label: 'Inquiry', sublabel: '"Is it available?"', icon: MessageCircle, color: 'lv5-flow-facebook' },
  { id: 'listing', label: 'Listing Sync', sublabel: '2BR Downtown', icon: Home, color: 'lv5-flow-primary-accent' },
  { id: 'history', label: 'Lead History', sublabel: 'Previous conversations', icon: Clock, color: 'lv5-flow-success' },
];

const outgoingDataTypes = [
  { id: 'reply', label: 'Reply Sent', sublabel: '"Yes, available!"', icon: Send, color: 'lv5-flow-success-primary' },
  { id: 'tour-confirm', label: 'Tour Scheduled', sublabel: 'Tomorrow 2:00 PM', icon: Calendar, color: 'lv5-flow-primary-facebook' },
  { id: 'application', label: 'Application Link', sublabel: 'Sent to lead', icon: FileText, color: 'lv5-flow-accent-success' },
];

interface FlowingDataProps {
  dataType: typeof incomingDataTypes[0];
  delay: number;
  yOffset: number;
  direction: 'left-to-right' | 'right-to-left';
}

const FlowingData = ({ dataType, delay, yOffset, direction }: FlowingDataProps) => {
  const Icon = dataType.icon;
  const isLeftToRight = direction === 'left-to-right';
  
  const gradientClass = dataType.color;
  
  return (
    <motion.div
      className={`absolute flex items-center gap-2 ${isLeftToRight ? 'left-0' : 'right-0'}`}
      style={{ top: `${yOffset}%` }}
      initial={{ 
        x: isLeftToRight ? '-100%' : '100%', 
        opacity: 0, 
        scale: 0.8 
      }}
      animate={{ 
        x: isLeftToRight ? ['0%', '100%', '200%'] : ['0%', '-100%', '-200%'],
        opacity: [0, 1, 1, 0],
        scale: [0.8, 1, 1, 0.8],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        repeatDelay: 8,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${gradientClass} lv5-data-particle`}>
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="pr-1">
          <p className="text-xs font-semibold text-white whitespace-nowrap">{dataType.label}</p>
          <p className="text-[10px] text-white/80 whitespace-nowrap">{dataType.sublabel}</p>
        </div>
      </div>
    </motion.div>
  );
};

export const DataFlowBridge = () => {
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    const showTimer = setInterval(() => {
      setShowSync(true);
      setTimeout(() => setShowSync(false), 2000);
    }, 6000);

    setTimeout(() => {
      setShowSync(true);
      setTimeout(() => setShowSync(false), 2000);
    }, 2000);

    return () => clearInterval(showTimer);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" data-testid="data-flow-bridge-v5">
      <div className="absolute inset-0 flex flex-col justify-center gap-6">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="relative h-0.5 w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/50 to-transparent"
              animate={{
                x: i % 2 === 0 ? ['-100%', '100%'] : ['100%', '-100%'],
              }}
              transition={{
                duration: 3,
                delay: i * 0.4,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-0">
        {incomingDataTypes.map((dataType, index) => (
          <FlowingData
            key={dataType.id}
            dataType={dataType}
            delay={index * 3}
            yOffset={10 + index * 14}
            direction="left-to-right"
          />
        ))}
      </div>

      <div className="absolute inset-0">
        {outgoingDataTypes.map((dataType, index) => (
          <FlowingData
            key={dataType.id}
            dataType={dataType}
            delay={1.5 + index * 3}
            yOffset={52 + index * 16}
            direction="right-to-left"
          />
        ))}
      </div>

      <AnimatePresence>
        {showSync && (
          <motion.div
            className="absolute z-10 flex flex-col items-center gap-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            data-testid="sync-indicator-v5"
          >
            <div className="lv5-integration-badge p-3 rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </motion.div>
            </div>
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-xs font-semibold text-primary whitespace-nowrap" data-testid="text-sync-api-v5">Real-time API</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Bidirectional Sync</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
};
