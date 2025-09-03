import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRedis = {
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: mockRedis,
}));

describe('Redis Lock Functionality', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should acquire lock successfully with NX and PX options', async () => {
    const { acquireLock } = await import('@/lib/redis-token-utils');
    mockRedis.set.mockResolvedValue('OK');

    const result = await acquireLock('test-lock', 30000);

    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith('test-lock', '1', 'NX', 'PX', 30000);
  });

  it('should fail to acquire lock when already exists', async () => {
    const { acquireLock } = await import('@/lib/redis-token-utils');
    mockRedis.set.mockResolvedValue(null);

    const result = await acquireLock('test-lock', 30000);

    expect(result).toBe(false);
    expect(mockRedis.set).toHaveBeenCalledWith('test-lock', '1', 'NX', 'PX', 30000);
  });
});
