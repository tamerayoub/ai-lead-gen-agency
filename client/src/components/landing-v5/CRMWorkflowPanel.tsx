import { motion } from 'framer-motion';
import { Inbox, Users, Home, ClipboardCheck, ArrowRight, MessageSquare, Calendar, FileText } from 'lucide-react';

const pipelineStages = [
  { id: 1, name: 'New', count: 12, colorClass: 'bg-accent' },
  { id: 2, name: 'Contacted', count: 8, colorClass: 'bg-primary' },
  { id: 3, name: 'Touring', count: 5, colorClass: 'lv5-bg-success' },
  { id: 4, name: 'Applied', count: 3, colorClass: 'lv5-bg-facebook' },
];

const recentLeads = [
  { id: 1, name: 'Sarah Mitchell', property: '2BR Downtown', status: 'New Lead', time: 'Just now' },
  { id: 2, name: 'James Kim', property: 'Studio Campus', status: 'Tour Scheduled', time: '5m ago' },
];

interface CRMWorkflowPanelProps {
  compact?: boolean;
}

export const CRMWorkflowPanel = ({ compact = false }: CRMWorkflowPanelProps) => {
  if (compact) {
    return (
      <motion.div
        className="relative w-full h-full min-h-0 flex flex-col bg-card rounded-2xl lv5-shadow-card overflow-hidden border border-border/50"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        data-testid="panel-crm-workflow-v5"
      >
        <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/30 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full lv5-bg-gradient-primary flex-shrink-0">
            <Home className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full lv5-bg-success-light-50 border border-border/30">
            <span className="w-1 h-1 rounded-full lv5-bg-success" />
            <span className="text-[10px] lv5-text-success font-medium" data-testid="status-crm-synced-v5">Synced</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-2 space-y-2 overflow-hidden">
          <div className="flex items-center gap-1">
            <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Pipeline</span>
          </div>
          <div className="flex items-center gap-1" data-testid="pipeline-stages-v5">
            {pipelineStages.map((stage, index) => (
              <motion.div
                key={stage.id}
                className="flex-1 min-w-0 relative"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="flex flex-col items-center p-1.5 rounded-lg bg-secondary/50 border border-border/30">
                  <div className={`w-6 h-6 rounded-full ${stage.colorClass} flex items-center justify-center mb-0.5`}>
                    <span className="text-[10px] font-bold text-white">{stage.count}</span>
                  </div>
                  <span className="text-[10px] font-medium text-foreground truncate block w-full text-center">{stage.name}</span>
                </div>
                {index < pipelineStages.length - 1 && (
                  <ArrowRight className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground z-10" />
                )}
              </motion.div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Leads</span>
            <span className="text-[10px] text-primary font-medium ml-auto" data-testid="text-inbox-count-v5">12</span>
          </div>
          <div className="space-y-1">
            {recentLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                className="p-1.5 rounded-lg bg-card border border-border/30"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.15 }}
                data-testid={`lead-item-v5-${lead.id}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 truncate">
                    <p className="text-[11px] font-medium text-foreground truncate">{lead.name.replace(/\s+(\w)\w*$/, ' $1.')}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{lead.property}</p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0" data-testid={`badge-lead-status-v5-${lead.id}`}>
                    <MessageSquare className="w-2.5 h-2.5 text-muted-foreground" />
                    <Calendar className="w-2.5 h-2.5 text-muted-foreground" />
                    <FileText className="w-2.5 h-2.5 text-muted-foreground" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="flex items-center gap-1.5 p-1.5 rounded-lg lv5-bg-success-light-50 border border-border/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            data-testid="status-synced-indicator-v5"
          >
            <ClipboardCheck className="w-3.5 h-3.5 lv5-text-success flex-shrink-0" />
            <span className="text-[10px] lv5-text-success font-medium truncate">Synced</span>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 lv5-bg-gradient-primary" data-testid="indicator-crm-bottom-v5" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="relative w-full h-full bg-card rounded-2xl lv5-shadow-card overflow-hidden border border-border/50"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      data-testid="panel-crm-workflow-v5"
    >
      <div className="flex items-center gap-4 p-5 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-center w-14 h-14 rounded-full lv5-bg-gradient-primary flex-shrink-0">
          <Home className="w-7 h-7 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-lg" data-testid="text-crm-panel-title-v5">Your Leasing Workflow</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full lv5-bg-success-light-50 border border-border/30">
          <span className="w-2 h-2 rounded-full lv5-bg-success" />
          <span className="text-sm lv5-text-success font-medium" data-testid="status-crm-synced-v5">Synced</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Leasing Pipeline</p>
          <div className="flex items-center gap-2.5" data-testid="pipeline-stages-v5">
            {pipelineStages.map((stage, index) => (
              <motion.div
                key={stage.id}
                className="flex-1 relative"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="flex flex-col items-center p-3 rounded-xl bg-secondary/50 border border-border/30">
                  <div className={`w-10 h-10 rounded-full ${stage.colorClass} flex items-center justify-center mb-1.5`}>
                    <span className="text-sm font-bold text-white">{stage.count}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{stage.name}</span>
                </div>
                {index < pipelineStages.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Lead Inbox</p>
            <span className="flex items-center gap-1.5 text-sm text-primary font-medium" data-testid="text-inbox-count-v5">
              <Inbox className="w-4 h-4" />
              12 new
            </span>
          </div>
          <div className="space-y-2.5">
            {recentLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                className="p-4 rounded-xl bg-card border border-border/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.15 }}
                data-testid={`lead-item-v5-${lead.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-medium text-foreground">{lead.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{lead.property}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0">{lead.time}</span>
                </div>
                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border/30">
                  <span className={`text-sm px-2.5 py-1 rounded-full ${
                    lead.status === 'New Lead' 
                      ? 'bg-accent/20 text-accent' 
                      : 'lv5-bg-success-light-50 lv5-text-success'
                  }`} data-testid={`badge-lead-status-v5-${lead.id}`}>
                    {lead.status}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="p-1.5 rounded" data-testid={`icon-message-v5-${lead.id}`}>
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </span>
                    <span className="p-1.5 rounded" data-testid={`icon-calendar-v5-${lead.id}`}>
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </span>
                    <span className="p-1.5 rounded" data-testid={`icon-file-v5-${lead.id}`}>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div 
          className="flex items-center gap-2.5 p-3 rounded-xl lv5-bg-success-light-50 border border-border/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          data-testid="status-synced-indicator-v5"
        >
          <ClipboardCheck className="w-5 h-5 lv5-text-success" />
          <span className="text-sm lv5-text-success font-medium">All conversations synced &bull; History preserved</span>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 lv5-bg-gradient-primary" data-testid="indicator-crm-bottom-v5" />
    </motion.div>
  );
};
