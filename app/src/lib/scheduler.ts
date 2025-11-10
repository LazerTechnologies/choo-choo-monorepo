import { type SchedulerLogCode, schedulerLog } from '@/lib/event-log';
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
      schedulerLog.info('already_initialized' as SchedulerLogCode, {
        msg: 'Already initialized, skipping...',
      });
      return;
    }

    schedulerLog.info('initialized' as SchedulerLogCode, {
      msg: 'Initializing scheduled jobs...',
    });

    // Check yoink availability every 5 minutes
    this.scheduleJob('yoink-availability-check', 5 * 60 * 1000, async () => {
      await this.checkYoinkAvailability();
    });

    this.isInitialized = true;
    schedulerLog.info('initialized' as SchedulerLogCode, {
      msg: 'Scheduled jobs initialized successfully',
    });
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
        schedulerLog.info('job_started' as SchedulerLogCode, {
          jobName,
          msg: `Running job: ${jobName}`,
        });
        await jobFunction();

        // Update job status on success
        this.jobStatus.set(jobName, { lastRun: new Date(), lastError: null });
        schedulerLog.info('job_completed' as SchedulerLogCode, {
          jobName,
          msg: `Job ${jobName} completed successfully`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        schedulerLog.error('job_failed' as SchedulerLogCode, {
          jobName,
          error: errorMessage,
          msg: `Error in job ${jobName}`,
        });

        // Update job status on error
        this.jobStatus.set(jobName, { lastRun: new Date(), lastError: errorMessage });
      }
    }, intervalMs);

    this.intervals.set(jobName, interval);
    schedulerLog.info('job_scheduled' as SchedulerLogCode, {
      jobName,
      intervalSeconds: intervalMs / 1000,
      msg: `Scheduled job '${jobName}' to run every ${intervalMs / 1000} seconds`,
    });
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
        schedulerLog.info('yoink_check_notification_sent' as SchedulerLogCode, {
          currentHolder: result.currentHolder,
          msg: 'Yoink availability notification sent to all users',
        });
      } else if (result.yoinkAvailable) {
        schedulerLog.info('yoink_check_already_sent' as SchedulerLogCode, {
          msg: 'Yoink is available but notification already sent',
        });
      } else {
        schedulerLog.info('yoink_check_not_available' as SchedulerLogCode, {
          reason: result.reason,
          msg: `Yoink not available: ${result.reason}`,
        });
      }
    } catch (error) {
      schedulerLog.error('job_failed' as SchedulerLogCode, {
        jobName: 'yoink-availability-check',
        error: error instanceof Error ? error.message : 'Unknown error',
        msg: 'Failed to check yoink availability',
      });
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
    schedulerLog.info('shutdown' as SchedulerLogCode, {
      msg: 'Shutting down scheduled jobs...',
    });

    for (const [jobName, interval] of this.intervals) {
      clearInterval(interval);
      schedulerLog.info('job_stopped' as SchedulerLogCode, {
        jobName,
        msg: `Stopped job: ${jobName}`,
      });
    }

    this.intervals.clear();
    this.jobStatus.clear();
    this.isInitialized = false;
    schedulerLog.info('shutdown' as SchedulerLogCode, {
      msg: 'All scheduled jobs stopped',
    });
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
