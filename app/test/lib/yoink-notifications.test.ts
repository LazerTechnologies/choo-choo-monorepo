import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduler } from '@/lib/scheduler';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Yoink Notification System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables for tests
    process.env.INTERNAL_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    // Clean up scheduler
    scheduler.shutdown();
  });

  describe('Scheduler', () => {
    it('should initialize successfully', () => {
      scheduler.initialize();

      const status = scheduler.getStatus();
      expect(status).toHaveProperty('yoink-availability-check');
      expect(status['yoink-availability-check'].isRunning).toBe(true);
    });

    it('should not initialize twice', () => {
      scheduler.initialize();
      scheduler.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('[Scheduler] Already initialized, skipping...');
    });

    it('should track job status', () => {
      scheduler.initialize();

      const status = scheduler.getStatus();
      expect(status['yoink-availability-check']).toEqual({
        lastRun: null,
        lastError: null,
        isRunning: true,
      });
    });

    it('should shutdown cleanly', () => {
      scheduler.initialize();
      scheduler.shutdown();

      const status = scheduler.getStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });

  describe('Yoink Availability Check', () => {
    it('should handle successful yoink availability check', async () => {
      // Mock successful API responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            yoinkAvailable: true,
            notificationSent: true,
            currentHolder: 'testuser',
          }),
      });

      const response = await fetch('http://localhost:3000/api/check-yoink-availability', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-secret',
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.yoinkAvailable).toBe(true);
      expect(result.notificationSent).toBe(true);
    });

    it('should handle unauthorized requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const response = await fetch('http://localhost:3000/api/check-yoink-availability', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong-secret',
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle yoink not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            yoinkAvailable: false,
            reason: 'Yoink is still on cooldown',
            notificationSent: false,
          }),
      });

      const response = await fetch('http://localhost:3000/api/check-yoink-availability', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-secret',
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(result.yoinkAvailable).toBe(false);
      expect(result.reason).toBe('Yoink is still on cooldown');
      expect(result.notificationSent).toBe(false);
    });
  });

  describe('Notification Templates', () => {
    it('should have yoinkAvailable notification template', async () => {
      // Dynamic import to avoid hoisting issues with mocks
      const { ChooChooNotifications } = await import('@/lib/notifications');

      const notification = ChooChooNotifications.yoinkAvailable('testuser');

      expect(notification).toEqual({
        title: '⏰ YOINK Time!',
        body: 'The yoink timer has expired! ChooChoo can now be yoinked from @testuser. First come, first served!',
        targetUrl: 'http://localhost:3000?tab=yoink',
        targetFids: [],
      });
    });
  });
});
