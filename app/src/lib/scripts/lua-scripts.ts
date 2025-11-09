/**
 * Lua script to create and swap a value in Redis with a TTL
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
		local current_tracker = redis.call('GET', current_token_id_key)
		if current_tracker then
			local tracker = cjson.decode(current_tracker)
			if token_id > tracker.currentTokenId then
				tracker.currentTokenId = token_id
				tracker.timestamp = cjson.decode(token_data).timestamp
				redis.call('SET', current_token_id_key, cjson.encode(tracker))
			end
		else
			-- Initialize tracker
			local new_tracker = {
				currentTokenId = token_id,
				timestamp = cjson.decode(token_data).timestamp
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
