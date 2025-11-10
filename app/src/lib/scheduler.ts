import { APP_URL } from './constants';

/**
 * Simple in-memory scheduler for Railway deployment that runs scheduled tasks
 * as part of the application process using setInterval
 */
class Scheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  private jobStatus: Map<string, { lastRun: Date | null; lastError: string | null }> = new Map();

  /**
   * Initialize the scheduler with all scheduled jobs
   * This should be called once when the application starts
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[Scheduler] Already initialized, skipping...');
      return;
    }

    console.log('[Scheduler] Initializing scheduled jobs...');

    // Check yoink availability every 5 minutes
    this.scheduleJob('yoink-availability-check', 5 * 60 * 1000, async () => {
      await this.checkYoinkAvailability();
    });

    this.isInitialized = true;
    console.log('[Scheduler] Scheduled jobs initialized successfully');
  }

  /**
   * Schedule a recurring job
   */
  private scheduleJob(jobName: string, intervalMs: number, jobFunction: () => Promise<void>): void {
    // Clear existing interval if it exists
    const existingInterval = this.intervals.get(jobName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Initialize job status
    this.jobStatus.set(jobName, { lastRun: null, lastError: null });

    // Schedule the job
    const interval = setInterval(async () => {
      try {
        console.log(`[Scheduler] Running job: ${jobName}`);
        await jobFunction();

        // Update job status on success
        this.jobStatus.set(jobName, { lastRun: new Date(), lastError: null });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Scheduler] Error in job ${jobName}:`, error);

        // Update job status on error
        this.jobStatus.set(jobName, { lastRun: new Date(), lastError: errorMessage });
      }
    }, intervalMs);

    this.intervals.set(jobName, interval);
    console.log(`[Scheduler] Scheduled job '${jobName}' to run every ${intervalMs / 1000} seconds`);
  }

  /**
   * Check yoink availability and send notifications if needed
   */
  private async checkYoinkAvailability(): Promise<void> {
    try {
      const response = await fetch(`${APP_URL}/api/check-yoink-availability`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_SECRET}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.notificationSent) {
        console.log(
          `[Scheduler] Yoink availability notification sent to all users. ChooChoo can be yoinked from: ${result.currentHolder})`,
        );
      } else if (result.yoinkAvailable) {
        console.log(`[Scheduler] Yoink is available but notification already sent`);
      } else {
        console.log(`[Scheduler] Yoink not available: ${result.reason}`);
      }
    } catch (error) {
      console.error('[Scheduler] Failed to check yoink availability:', error);
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  public getStatus(): Record<
    string,
    { lastRun: Date | null; lastError: string | null; isRunning: boolean }
  > {
    const status: Record<
      string,
      { lastRun: Date | null; lastError: string | null; isRunning: boolean }
    > = {};

    for (const [jobName, jobStatus] of this.jobStatus) {
      status[jobName] = {
        ...jobStatus,
        isRunning: this.intervals.has(jobName),
      };
    }

    return status;
  }

  /**
   * Stop all scheduled jobs
   */
  public shutdown(): void {
    console.log('[Scheduler] Shutting down scheduled jobs...');

    for (const [jobName, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`[Scheduler] Stopped job: ${jobName}`);
    }

    this.intervals.clear();
    this.jobStatus.clear();
    this.isInitialized = false;
    console.log('[Scheduler] All scheduled jobs stopped');
  }
}

// Export singleton instance
export const scheduler = new Scheduler();

/**
 * Initialize scheduler when this module is imported
 * This ensures jobs start running when the application starts
 */
if (typeof window === 'undefined') {
  // Only run on server side
  scheduler.initialize();
}
