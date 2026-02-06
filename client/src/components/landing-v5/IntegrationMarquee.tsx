import { Building2, Cloud, Database, Home, Mail, Calendar, MessageSquare, Plug } from 'lucide-react';
import { Card } from '@/components/ui/card';

const integrationTypes = [
  { name: "Property Management", icon: Building2 },
  { name: "CRM & Databases", icon: Database },
  { name: "Listing Sites", icon: Home },
  { name: "Email", icon: Mail },
  { name: "Calendar", icon: Calendar },
  { name: "Messaging", icon: MessageSquare },
  { name: "API & Webhooks", icon: Plug },
  { name: "Cloud Sync", icon: Cloud },
];

export function IntegrationMarquee() {
  return (
    <div className="relative overflow-hidden py-4" data-testid="integration-marquee-v5">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      <div className="flex animate-marquee gap-4" style={{ width: 'max-content' }}>
        {integrationTypes.map((item) => (
          <div key={`${item.name}-1`} className="flex-shrink-0">
            <Card className="w-[140px] h-[100px] p-3 text-center border border-border/50 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card">
              <div className="flex flex-col items-center gap-2 h-full justify-center">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-foreground">{item.name}</span>
              </div>
            </Card>
          </div>
        ))}
        {integrationTypes.map((item) => (
          <div key={`${item.name}-2`} className="flex-shrink-0">
            <Card className="w-[140px] h-[100px] p-3 text-center border border-border/50 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card">
              <div className="flex flex-col items-center gap-2 h-full justify-center">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-foreground">{item.name}</span>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
