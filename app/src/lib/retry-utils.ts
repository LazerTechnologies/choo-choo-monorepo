import { retryLog, toRetryLogCode } from "./event-log";

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
	maxAttempts: number = 3,
): Promise<T> {
	let lastError: Error = new Error(`All ${maxAttempts} retry attempts failed`);

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			retryLog.info(toRetryLogCode("operation", "attempt"), {
				operationName,
				attempt,
			});

			const result = await operation();

			retryLog.info(toRetryLogCode("operation", "success"), {
				operationName,
				attempt,
			});

			return result;
		} catch (err) {
			lastError = err as Error;
			retryLog.warn(toRetryLogCode("operation", "failed"), {
				operationName,
				attempt,
				error: err,
				maxAttempts,
			});

			if (attempt < maxAttempts) {
				const delayMs = 2 ** (attempt - 1) * 1000;

				retryLog.info(toRetryLogCode("backoff", "scheduled"), {
					operationName,
					attempt,
					delayMs,
					nextAttempt: attempt + 1,
				});

				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	retryLog.error(toRetryLogCode("operation", "exhausted"), {
		operationName,
		maxAttempts,
		error: lastError,
	});

	throw lastError;
}
