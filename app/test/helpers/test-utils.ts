import { expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

/**
 * Wait for all pending promises to resolve
 * Useful for testing async operations
 */
export async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a specific number of milliseconds
 * Useful when testing with fake timers
 */
export async function waitForMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that a mock function was called with specific arguments
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectCalledWith<T extends (...args: any[]) => any>(
  mockFn: T,
  ...expectedArgs: Parameters<T>
) {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
}

/**
 * Assert that a mock function was called a specific number of times
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectCalledTimes<T extends (...args: any[]) => any>(mockFn: T, times: number) {
  expect(mockFn).toHaveBeenCalledTimes(times);
}

/**
 * Assert that a mock function was not called
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectNotCalled<T extends (...args: any[]) => any>(mockFn: T) {
  expect(mockFn).not.toHaveBeenCalled();
}

/**
 * Wait for a mock function to be called
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function waitForMockCall<T extends (...args: any[]) => any>(
  mockFn: T,
  timeout: number = 1000
) {
  await waitFor(() => expect(mockFn).toHaveBeenCalled(), { timeout });
}

/**
 * Wait for a mock function to be called with specific arguments
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function waitForMockCallWith<T extends (...args: any[]) => any>(
  mockFn: T,
  expectedArgs: Parameters<T>,
  timeout: number = 1000
) {
  await waitFor(() => expect(mockFn).toHaveBeenCalledWith(...expectedArgs), { timeout });
}

/**
 * Create a promise that resolves after a delay
 * Useful for simulating network delays in tests
 */
export function createDelayedPromise<T>(value: T, delayMs: number = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

/**
 * Create a promise that rejects after a delay
 * Useful for simulating network errors in tests
 */
export function createDelayedRejection(error: Error, delayMs: number = 100): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(error), delayMs));
}

/**
 * Mock console methods and restore them after test
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();

  return () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };
}

/**
 * Assert that console.error was called with specific message
 */
export function expectConsoleError(message: string) {
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining(message));
}

/**
 * Assert that console.warn was called with specific message
 */
export function expectConsoleWarn(message: string) {
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(message));
}

/**
 * Create a test scenario for concurrent operations
 */
export async function testConcurrentOperations<T>(
  operations: (() => Promise<T>)[],
  expectations: {
    successCount?: number;
    failureCount?: number;
    specificResults?: T[];
  } = {}
) {
  const results = await Promise.allSettled(operations.map((op) => op()));

  const successes = results.filter((r) => r.status === 'fulfilled');
  const failures = results.filter((r) => r.status === 'rejected');

  if (expectations.successCount !== undefined) {
    expect(successes).toHaveLength(expectations.successCount);
  }

  if (expectations.failureCount !== undefined) {
    expect(failures).toHaveLength(expectations.failureCount);
  }

  if (expectations.specificResults) {
    const successValues = successes.map((r) => (r as PromiseFulfilledResult<T>).value);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(successValues).toEqual(expect.arrayContaining(expectations.specificResults as any));
  }

  return { successes, failures, results };
}

/**
 * Test helper for Redis lock scenarios
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLockTestScenario(
  lockKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  operation: () => Promise<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRedis: any
) {
  return {
    async testLockAcquired() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRedis.set.mockImplementation((key: string, value: string, options?: any) => {
        if (key === lockKey && options?.NX) {
          return Promise.resolve('OK');
        }
        return Promise.resolve('OK');
      });

      const result = await operation();
      expect(mockRedis.set).toHaveBeenCalledWith(
        lockKey,
        expect.any(String),
        expect.objectContaining({ NX: true })
      );
      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
      return result;
    },

    async testLockNotAcquired() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRedis.set.mockImplementation((key: string, value: string, options?: any) => {
        if (key === lockKey && options?.NX) {
          return Promise.resolve(null);
        }
        return Promise.resolve('OK');
      });

      const result = await operation();
      expect(mockRedis.set).toHaveBeenCalledWith(
        lockKey,
        expect.any(String),
        expect.objectContaining({ NX: true })
      );
      expect(mockRedis.del).not.toHaveBeenCalledWith(lockKey);
      return result;
    },
  };
}

/**
 * Test helper for workflow state transitions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWorkflowTestHelper(mockFetch: any) {
  return {
    expectWorkflowTransition(expectedState: string) {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/workflow-state'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(`"state":"${expectedState}"`),
        })
      );
    },

    expectWorkflowNotChanged() {
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/workflow-state'),
        expect.any(Object)
      );
    },
  };
}

/**
 * Test helper for cast sending
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCastTestHelper(mockFetch: any) {
  return {
    expectCastSent(text: string, idem?: string) {
      const expectedBody = idem
        ? expect.stringContaining(`"text":"${text}"`) && expect.stringContaining(`"idem":"${idem}"`)
        : expect.stringContaining(`"text":"${text}"`);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/internal/send-cast'),
        expect.objectContaining({
          method: 'POST',
          body: expectedBody,
        })
      );
    },

    expectNoCastsSent() {
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/internal/send-cast'),
        expect.any(Object)
      );
    },
  };
}
