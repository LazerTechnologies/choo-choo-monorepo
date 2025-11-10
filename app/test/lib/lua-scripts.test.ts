import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis before imports
vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: {
    eval: vi.fn(),
  },
}));

import { ATOMIC_PROMOTION_SCRIPT, CREATE_AND_SWAP_SCRIPT } from '@/lib/scripts/lua-scripts';

describe('Lua Scripts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CREATE_AND_SWAP_SCRIPT', () => {
    it('should contain compare-and-swap logic', () => {
      expect(CREATE_AND_SWAP_SCRIPT).toContain('local current = redis.call');
      expect(CREATE_AND_SWAP_SCRIPT).toContain('if current == expected then');
      expect(CREATE_AND_SWAP_SCRIPT).toContain('return 1');
      expect(CREATE_AND_SWAP_SCRIPT).toContain('return 0');
    });

    it('should set value with TTL on successful comparison', () => {
      expect(CREATE_AND_SWAP_SCRIPT).toContain("'EX'");
      expect(CREATE_AND_SWAP_SCRIPT).toContain('ttl_seconds');
    });
  });

  describe('ATOMIC_PROMOTION_SCRIPT', () => {
    it('should validate token_id conversion', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('tonumber(ARGV[4])');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if not token_id then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'invalid_token_id'}");
    });

    it('should validate staging entry exists', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("redis.call('EXISTS', staging_key)");
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if staging_exists == 0 then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'staging_not_found'}");
    });

    it('should use pcall for JSON decoding with error handling', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('pcall(cjson.decode, token_data)');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if not ok_token then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'invalid_token_data_json'}");
    });

    it('should validate timestamp field exists', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if not decoded_token_data.timestamp then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'missing_timestamp'}");
    });

    it('should handle tracker JSON decode errors', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('pcall(cjson.decode, current_tracker)');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if not ok_tracker then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'invalid_tracker_json'}");
    });

    it('should use NX flag for idempotent token creation', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("redis.call('SET', token_key, token_data, 'NX')");
    });

    it('should check for token data mismatch on existing tokens', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if existing ~= token_data then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return {err = 'token_data_mismatch'}");
    });

    it('should update monotonically increasing token ID tracker', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('if token_id > tracker.currentTokenId then');
      expect(ATOMIC_PROMOTION_SCRIPT).toContain('tracker.currentTokenId = token_id');
    });

    it('should delete staging entry after successful promotion', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("redis.call('DEL', staging_key)");
    });

    it('should return created or exists status', () => {
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return 'created'");
      expect(ATOMIC_PROMOTION_SCRIPT).toContain("return 'exists'");
    });
  });

  describe('Lua Script Error Scenarios', () => {
    it('should handle all documented error cases in ATOMIC_PROMOTION_SCRIPT', () => {
      const errorCases = [
        'invalid_token_id',
        'staging_not_found',
        'token_data_mismatch',
        'invalid_token_data_json',
        'invalid_tracker_json',
        'missing_timestamp',
      ];

      errorCases.forEach((errorCase) => {
        expect(ATOMIC_PROMOTION_SCRIPT).toContain(`{err = '${errorCase}'}`);
      });
    });
  });
});
