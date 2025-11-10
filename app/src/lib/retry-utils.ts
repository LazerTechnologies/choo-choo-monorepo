import { retryLog, toRetryLogCode } from './event-log';

/**
 * Retry an operation with exponential backoff
 * @param operation - The async function to retry
 * @param operationName - Name for logging purposes
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @returns The result of the operation
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts = 3,
): Promise<T> {
  let lastError: Error = new Error(`All ${maxAttempts} retry attempts failed`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Only log first and last attempts to reduce log volume
      if (attempt === 1 || attempt === maxAttempts) {
        retryLog.info(toRetryLogCode('operation', 'attempt'), {
          operationName,
          attempt,
        });
      }

      const result = await operation();

      // Only log success if it took multiple attempts
      if (attempt > 1) {
        retryLog.info(toRetryLogCode('operation', 'success'), {
          operationName,
          attempt,
          retriesNeeded: attempt - 1,
        });
      }

      return result;
    } catch (err) {
      lastError = err as Error;

      // Only log intermediate failures at warn level on final attempt
      if (attempt === maxAttempts) {
        retryLog.warn(toRetryLogCode('operation', 'failed'), {
          operationName,
          attempt,
          error: err,
          maxAttempts,
        });
      }

      if (attempt < maxAttempts) {
        const baseDelayMs = Math.min(2 ** (attempt - 1) * 1000, 30000);
        const jitter = Math.random() * 0.3 * baseDelayMs;
        const delayMs = baseDelayMs + jitter;

        // Only log backoff schedule on first retry to reduce noise
        if (attempt === 1) {
          retryLog.info(toRetryLogCode('backoff', 'scheduled'), {
            operationName,
            attempt,
            delayMs,
            nextAttempt: attempt + 1,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  retryLog.error(toRetryLogCode('operation', 'exhausted'), {
    operationName,
    maxAttempts,
    error: lastError,
  });

  throw lastError;
}
