// In-memory sync progress tracking
interface SyncProgress {
  isRunning: boolean;
  totalEmails: number;
  processedEmails: number;
  currentStep: string;
  logs: SyncLog[];
  summary?: {
    created: number;
    updated?: number;
    total: number;
    duplicates: number;
    skipped: number;
    errors: number;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  isCancelled?: boolean;
  createdLeadIds?: string[]; // Track leads created in this sync
}

interface SyncLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

class SyncProgressTracker {
  private progress: SyncProgress = {
    isRunning: false,
    totalEmails: 0,
    processedEmails: 0,
    currentStep: '',
    logs: [],
  };

  start(totalEmails: number) {
    this.progress = {
      isRunning: true,
      totalEmails,
      processedEmails: 0,
      currentStep: 'Starting sync...',
      logs: [],
      startedAt: new Date(),
      createdLeadIds: [], // Initialize empty array for tracking
    };
    this.addLog('info', '🔄 Gmail sync started...');
  }

  addCreatedLeadId(leadId: string) {
    if (!this.progress.createdLeadIds) {
      this.progress.createdLeadIds = [];
    }
    this.progress.createdLeadIds.push(leadId);
  }

  getCreatedLeadIds(): string[] {
    return this.progress.createdLeadIds || [];
  }

  setTotal(totalEmails: number) {
    this.progress.totalEmails = totalEmails;
  }

  updateStep(step: string) {
    this.progress.currentStep = step;
  }

  incrementProcessed(emailsProcessed: number = 1) {
    this.progress.processedEmails += emailsProcessed;
  }

  addLog(type: SyncLog['type'], message: string, details?: any) {
    this.progress.logs.push({
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    });
  }

  complete(summary: SyncProgress['summary']) {
    this.progress.isRunning = false;
    this.progress.summary = summary;
    this.progress.completedAt = new Date();
    this.progress.currentStep = 'Sync completed';
  }

  fail(error: string) {
    this.progress.isRunning = false;
    this.progress.error = error;
    this.progress.completedAt = new Date();
    this.progress.currentStep = 'Sync failed';
    this.addLog('error', `❌ Sync failed: ${error}`);
  }

  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  reset() {
    this.progress = {
      isRunning: false,
      totalEmails: 0,
      processedEmails: 0,
      currentStep: '',
      logs: [],
      isCancelled: false,
    };
  }

  cancel() {
    console.log('[Sync Cancel] Current summary before cancel:', this.progress.summary);
    console.log('[Sync Cancel] Created lead IDs:', this.progress.createdLeadIds);
    
    // Compute summary from tracking data when cancelled
    const created = (this.progress.createdLeadIds || []).length;
    
    // Count updates, duplicates, skipped, and errors from logs
    let updated = 0;
    let duplicates = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const log of this.progress.logs) {
      // Count thread replies and added conversation messages as updates
      if (log.message.includes('Thread reply') || 
          log.message.includes('Added outgoing reply') || 
          log.message.includes('Added received reply')) {
        updated++;
      } else if (log.message.includes('duplicate')) {
        duplicates++;
      } else if (log.message.includes('Skipped')) {
        skipped++;
      } else if (log.type === 'error') {
        errors++;
      }
    }
    
    // Set the computed summary
    this.progress.summary = {
      created,
      updated,
      total: created + updated,
      duplicates,
      skipped,
      errors,
    };
    
    this.progress.isCancelled = true;
    this.progress.isRunning = false;
    this.progress.currentStep = 'Sync cancelled';
    this.progress.completedAt = new Date();
    this.addLog('warning', '⚠️ Sync cancelled by user');
    
    console.log('[Sync Cancel] Computed summary after cancel:', this.progress.summary);
  }

  isCancelled(): boolean {
    return this.progress.isCancelled || false;
  }
}

export const syncProgressTracker = new SyncProgressTracker();
