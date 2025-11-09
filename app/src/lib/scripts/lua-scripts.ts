/**
 * Lua script for atomic compare-and-swap with TTL (optimistic locking)
 *
 * Purpose: Implements optimistic concurrency control for updating existing keys.
 * This is used by updateStaging() to prevent lost updates from concurrent modifications.
 *
 * IMPORTANT: This script is designed for UPDATE operations on EXISTING keys only.
 * The caller MUST verify the key exists before calling this script (see updateStaging).
 *
 * Why this works for updates only:
 * - updateStaging() calls getStaging() first (line 133 in staging-manager.ts)
 * - If key doesn't exist, getStaging() returns null
 * - updateStaging() immediately returns null (line 134), never calling this script
 * - Therefore, this script is ONLY called when the key exists
 *
 * The script itself doesn't enforce this constraint because:
 * 1. Redis GET on non-existent key returns false (Lua boolean)
 * 2. ARGV[1] (expected) is always a JSON string from existing data
 * 3. false (from GET) will never equal a JSON string (from ARGV[1])
 * 4. So the comparison fails and returns 0, preventing accidental creation
 *
 * Usage pattern:
 * 1. Read current value from Redis (getStaging)
 * 2. If key doesn't exist, return null (don't call this script)
 * 3. Modify the value
 * 4. Call this script with the original JSON string as 'expected'
 * 5. If script returns 1, update succeeded
 * 6. If script returns 0, value was modified concurrently - retry from step 1
 *
 * Parameters:
 * - KEYS[1]: Redis key to update
 * - ARGV[1]: Expected current value (JSON string from getStaging)
 * - ARGV[2]: New value to set (JSON string)
 * - ARGV[3]: TTL in seconds
 *
 * Returns:
 * - 1 if update succeeded (current value matched expected)
 * - 0 if update failed (concurrent modification detected)
 */
export const CREATE_AND_SWAP_SCRIPT = `
			local key = KEYS[1]
			local expected = ARGV[1]
			local new_value = ARGV[2]
			local ttl_seconds = tonumber(ARGV[3])

			local current = redis.call('GET', key)
			if current == expected then
				redis.call('SET', key, new_value, 'EX', ttl_seconds)
				return 1
			else
				return 0
			end
		`;

/**
 * Lua script to promote a staging entry to permanent storage
 *
 * This script atomically:
 * 1. Validates staging entry exists
 * 2. Writes token data (with idempotency check)
 * 3. Updates last moved timestamp
 * 4. Updates current holder
 * 5. Updates token ID tracker (monotonically)
 * 6. Deletes staging entry
 *
 * All operations succeed or fail together (atomic).
 *
 * Parameters:
 * - KEYS[1]: token key (e.g., "token42")
 * - KEYS[2]: last-moved-timestamp key
 * - KEYS[3]: current-holder key
 * - KEYS[4]: staging key (e.g., "staging:42")
 * - KEYS[5]: current-token-id key
 * - ARGV[1]: token data (JSON string)
 * - ARGV[2]: last moved data (JSON string)
 * - ARGV[3]: current holder data (JSON string)
 * - ARGV[4]: token ID (numeric string)
 *
 * Returns:
 * - 'created' if token was newly created
 * - 'exists' if token already existed (idempotent)
 * - {err: 'staging_not_found'} if staging doesn't exist
 * - {err: 'token_data_mismatch'} if existing token has different data
 * - {err: 'invalid_token_id'} if token ID is not a valid number
 * - {err: 'invalid_token_data_json'} if token data is malformed JSON
 * - {err: 'invalid_tracker_json'} if tracker data is malformed JSON
 * - {err: 'missing_timestamp'} if token data lacks required timestamp field
 */
export const ATOMIC_PROMOTION_SCRIPT = `
		local token_key = KEYS[1]
		local last_moved_key = KEYS[2]
		local current_holder_key = KEYS[3]
		local staging_key = KEYS[4]
		local current_token_id_key = KEYS[5]

		local token_data = ARGV[1]
		local last_moved_data = ARGV[2]
		local current_holder_data = ARGV[3]
		local token_id = tonumber(ARGV[4])

		-- Validate token_id conversion
		if not token_id then
			return {err = 'invalid_token_id'}
		end

		-- Check if staging entry exists
		local staging_exists = redis.call('EXISTS', staging_key)
		if staging_exists == 0 then
			return {err = 'staging_not_found'}
		end

		-- Attempt to set token data (NX = only if not exists)
		local token_set = redis.call('SET', token_key, token_data, 'NX')
		local token_created = false
		if token_set then
			token_created = true
		else
			-- Token already exists, check if we should proceed
			-- This is idempotent - if called multiple times, we still succeed
			local existing = redis.call('GET', token_key)
			if existing ~= token_data then
				-- Different data exists, this is an error condition
				return {err = 'token_data_mismatch'}
			end
		end

		-- Update last moved timestamp
		redis.call('SET', last_moved_key, last_moved_data)

		-- Update current holder
		redis.call('SET', current_holder_key, current_holder_data)

	-- Update current token ID tracker (monotonically increasing)
	-- Decode token_data once with error handling
	local ok_token, decoded_token_data = pcall(cjson.decode, token_data)
	if not ok_token then
		return {err = 'invalid_token_data_json'}
	end

	-- Validate required timestamp field exists
	if not decoded_token_data.timestamp then
		return {err = 'missing_timestamp'}
	end

	local current_tracker = redis.call('GET', current_token_id_key)
		if current_tracker then
			-- Decode existing tracker with error handling
			local ok_tracker, tracker = pcall(cjson.decode, current_tracker)
			if not ok_tracker then
				return {err = 'invalid_tracker_json'}
			end

			-- Update tracker if new token ID is higher (monotonic)
			if token_id > tracker.currentTokenId then
				tracker.currentTokenId = token_id
				tracker.timestamp = decoded_token_data.timestamp
				redis.call('SET', current_token_id_key, cjson.encode(tracker))
			end
		else
			-- Initialize tracker with new token
			local new_tracker = {
				currentTokenId = token_id,
				timestamp = decoded_token_data.timestamp
			}
			redis.call('SET', current_token_id_key, cjson.encode(new_tracker))
		end

		-- Delete staging entry (cleanup)
		redis.call('DEL', staging_key)

		-- Return success status
		if token_created then
			return 'created'
		else
			return 'exists'
		end
	`;
