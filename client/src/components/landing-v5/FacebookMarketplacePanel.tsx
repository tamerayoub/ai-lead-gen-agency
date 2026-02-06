import { motion } from 'framer-motion';
import { MessageCircle, Heart, MapPin, User, Home } from 'lucide-react';

const FacebookLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="20" fill="#1877F2"/>
    <path 
      d="M27.785 25.781L28.672 20H23.125V16.25C23.125 14.797 23.836 13.375 26.117 13.375H28.875V8.359C28.875 8.359 26.32 7.875 23.879 7.875C18.772 7.875 15.312 11.083 15.312 16.688V20H10.203V25.781H15.312V38.719C16.335 38.875 17.379 39 18.438 39C19.496 39 20.54 38.875 21.562 38.719V25.781H27.785Z" 
      fill="white"
    />
  </svg>
);

const listings = [
  { id: 1, title: '2BR Apartment Downtown', price: '$1,850/mo', location: 'Financial District' },
  { id: 2, title: 'Studio Near Campus', price: '$1,200/mo', location: 'University Area' },
  { id: 3, title: '3BR Family Home', price: '$2,400/mo', location: 'Suburbia Heights' },
];

const messages = [
  { id: 1, name: 'Sarah M.', message: 'Is the 2BR still available?', time: '2m ago' },
  { id: 2, name: 'James K.', message: 'Can I schedule a tour?', time: '5m ago' },
  { id: 3, name: 'Maria L.', message: 'What are the pet policies?', time: '8m ago' },
];

interface FacebookMarketplacePanelProps {
  compact?: boolean;
}

export const FacebookMarketplacePanel = ({ compact = false }: FacebookMarketplacePanelProps) => {
  if (compact) {
    return (
      <motion.div
        className="relative w-full h-full min-h-0 flex flex-col bg-card rounded-2xl lv5-shadow-card overflow-hidden border border-border/50"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        data-testid="panel-facebook-marketplace-v5"
      >
        <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/30 flex-shrink-0">
          <FacebookLogo className="w-8 h-8 flex-shrink-0" />
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full lv5-bg-success lv5-animate-pulse" />
            <span className="text-[10px] lv5-text-success font-medium" data-testid="status-fb-live-v5">Live</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-2 space-y-2 overflow-hidden">
          <div className="flex items-center gap-1">
            <Home className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Listings</span>
          </div>
          <div className="space-y-1">
            {listings.map((listing, index) => (
              <motion.div
                key={listing.id}
                className="flex items-center gap-1.5 p-1.5 rounded-lg bg-secondary/50 border border-border/30"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                data-testid={`listing-item-v5-${listing.id}`}
              >
                <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <p className="text-[11px] font-medium text-foreground truncate">{listing.title}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{listing.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[11px] font-semibold text-primary">{listing.price}</span>
                  <Heart className="w-2.5 h-2.5 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Messages</span>
          </div>
          <div className="space-y-1">
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                className="flex items-center gap-1.5 p-1.5 rounded-lg bg-card border border-border/30"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.15 }}
                data-testid={`message-item-v5-${msg.id}`}
              >
                <div className="w-6 h-6 rounded-full lv5-bg-facebook-light-20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 lv5-text-facebook" />
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <p className="text-[11px] font-medium text-foreground truncate">{msg.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{msg.message}</p>
                </div>
                <MessageCircle className="w-3 h-3 lv5-text-facebook flex-shrink-0" />
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 lv5-bg-facebook" data-testid="indicator-fb-bottom-v5" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="relative w-full h-full bg-card rounded-2xl lv5-shadow-card overflow-hidden border border-border/50"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      data-testid="panel-facebook-marketplace-v5"
    >
      <div className="flex items-center gap-4 p-5 border-b border-border bg-secondary/30">
        <FacebookLogo className="w-14 h-14 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-lg" data-testid="text-fb-panel-title-v5">Facebook Marketplace</h3>
          <p className="text-base text-muted-foreground">Your Rental Listings</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full lv5-bg-success lv5-animate-pulse" />
          <span className="text-sm lv5-text-success font-medium" data-testid="status-fb-live-v5">Live</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Listings</p>
          <div className="space-y-2.5">
            {listings.map((listing, index) => (
              <motion.div
                key={listing.id}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary/50 border border-border/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                data-testid={`listing-item-v5-${listing.id}`}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <Home className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground truncate">{listing.title}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <MapPin className="w-4 h-4" />
                    <span>{listing.location}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-primary">{listing.price}</p>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">24</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">New Messages</p>
          <div className="space-y-2.5">
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/30"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.15 }}
                data-testid={`message-item-v5-${msg.id}`}
              >
                <div className="w-11 h-11 rounded-full lv5-bg-facebook-light-20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 lv5-text-facebook" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-medium text-foreground">{msg.name}</p>
                    <span className="text-sm text-muted-foreground flex-shrink-0">{msg.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{msg.message}</p>
                </div>
                <MessageCircle className="w-5 h-5 lv5-text-facebook flex-shrink-0 mt-0.5" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 lv5-bg-facebook" data-testid="indicator-fb-bottom-v5" />
    </motion.div>
  );
};
