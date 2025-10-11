// In-memory sync progress tracking
interface SyncProgress {
  isRunning: boolean;
  totalEmails: number;
  processedEmails: number;
  currentStep: string;
  logs: SyncLog[];
  summary?: {
    created: number;
    duplicates: number;
    skipped: number;
    errors: number;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  isCancelled?: boolean;
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
    };
    this.addLog('info', '🔄 Gmail sync started...');
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
    this.progress.isCancelled = true;
    this.progress.isRunning = false;
    this.progress.currentStep = 'Sync cancelled';
    this.progress.completedAt = new Date();
    this.addLog('warning', '⚠️ Sync cancelled by user');
  }

  isCancelled(): boolean {
    return this.progress.isCancelled || false;
  }
}

export const syncProgressTracker = new SyncProgressTracker();
