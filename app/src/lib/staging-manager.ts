import {
	type OrchestratorOperation,
	orchestratorLog,
	redisLog,
	stagingLog,
	toOrchestratorLogCode,
} from "@/lib/event-log";
import { CURRENT_HOLDER_KEY, redis } from "@/lib/kv";
import type { TokenData } from "@/types/nft";

interface RedisWithSetOptions {
	set: (
		key: string,
		value: string,
		...args: (string | number)[]
	) => Promise<string | null>;
}

const STAGING_KEY_PREFIX = "staging";
const STAGING_TTL_SECONDS = 3_600;

type StagingStatus =
	| "preparing"
	| "pinata_uploaded"
	| "minted"
	| "metadata_set"
	| "completed"
	| "failed";

interface StagingParticipant {
	fid: number;
	username: string;
	displayName?: string;
	pfpUrl?: string;
	address: string;
}

export interface StagingMovement {
	tokenId: number;
	status: StagingStatus;
	orchestrator: OrchestratorOperation;
	createdAt: string;
	retryCount: number;
	version: number;
	lastError?: string;
	needsMetadataRetry?: boolean;
	imageHash?: string;
	metadataHash?: string;
	tokenURI?: TokenData["tokenURI"];
	attributes?: TokenData["attributes"];
	txHash?: string;
	blockNumber?: number;
	sourceCastHash?: string;
	totalEligibleReactors?: number;
	newHolder: StagingParticipant;
	departingPassenger: StagingParticipant;
}

function getStagingKey(tokenId: number): string {
	return `${STAGING_KEY_PREFIX}:${tokenId}`;
}

export async function createStaging(
	tokenId: number,
	staging: Omit<
		StagingMovement,
		"tokenId" | "status" | "createdAt" | "retryCount" | "version"
	>,
): Promise<void> {
	const payload: StagingMovement = {
		tokenId,
		status: "preparing",
		createdAt: new Date().toISOString(),
		retryCount: 0,
		version: 1,
		...staging,
	};

	const client = redis as unknown as RedisWithSetOptions;
	const key = getStagingKey(tokenId);
	const created = await client.set(
		key,
		JSON.stringify(payload),
		"NX",
		"EX",
		STAGING_TTL_SECONDS,
	);

	if (created !== "OK") {
		stagingLog.warn("lifecycle.exists", {
			tokenId,
			msg: "Staging already exists, skipping creation",
		});
		return;
	}

	stagingLog.info("lifecycle.created", {
		tokenId,
		status: payload.status,
	});
}

export async function getStaging(
	tokenId: number,
): Promise<StagingMovement | null> {
	const key = getStagingKey(tokenId);
	const data = await redis.get(key);
	if (!data) return null;

	try {
		return JSON.parse(data) as StagingMovement;
	} catch (error) {
		stagingLog.error("validation.parse_failed", {
			tokenId,
			error,
		});
		return null;
	}
}

export async function updateStaging(
	tokenId: number,
	updates: Partial<Omit<StagingMovement, "createdAt" | "version">>,
	maxRetries = 3,
): Promise<StagingMovement | null> {
	const key = getStagingKey(tokenId);

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		const current = await getStaging(tokenId);
		if (!current) return null;

		const next: StagingMovement = {
			...current,
			...updates,
			tokenId,
			version: current.version + 1,
		};

		const currentData = JSON.stringify(current);

		// Use Lua script for atomic compare-and-swap
		const script = `
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

		try {
			const result = await redis.eval(
				script,
				1,
				key,
				currentData,
				JSON.stringify(next),
				STAGING_TTL_SECONDS.toString(),
			);

			if (result === 1) {
				stagingLog.info("lifecycle.updated", {
					tokenId,
					status: next.status,
					version: next.version,
				});
				return next;
			}

			// Conflict detected, retry
			stagingLog.warn("lifecycle.conflict", {
				tokenId,
				attempt,
				expectedVersion: current.version,
				msg: "Concurrent update detected, retrying",
			});

			if (attempt < maxRetries) {
				await new Promise((resolve) =>
					setTimeout(resolve, Math.random() * 50 * attempt),
				);
			}
		} catch (error) {
			stagingLog.error("lifecycle.failed", {
				tokenId,
				attempt,
				error,
				context: "update_failed",
			});
			throw error;
		}
	}

	stagingLog.error("lifecycle.failed", {
		tokenId,
		maxRetries,
		context: "conflict_exhausted",
		msg: "Failed to update staging after max retries due to conflicts",
	});

	return null;
}

export async function abandonStaging(
	tokenId: number,
	reason: string,
): Promise<void> {
	const updated = await updateStaging(tokenId, {
		status: "failed",
		lastError: reason,
	});

	if (updated) {
		stagingLog.error("lifecycle.abandoned", {
			tokenId,
			reason,
		});
	}
}

function assertPromotable(
	staging: StagingMovement,
): asserts staging is StagingMovement & {
	imageHash: string;
	metadataHash: string;
	tokenURI: string;
	txHash: string;
} {
	const requiredFields: Array<keyof StagingMovement> = [
		"imageHash",
		"metadataHash",
		"tokenURI",
		"txHash",
	];

	for (const field of requiredFields) {
		if (!staging[field]) {
			throw new Error(
				`Cannot promote staging entry missing ${field as string}`,
			);
		}
	}
}

async function publishCurrentHolderUpdate(): Promise<void> {
	try {
		const { redisPub, CURRENT_HOLDER_CHANNEL } = await import("@/lib/kv");
		await redisPub.publish(
			CURRENT_HOLDER_CHANNEL,
			JSON.stringify({ type: "holder-updated" }),
		);
	} catch (error) {
		redisLog.warn("publish.failed", {
			error,
		});
	}
}

function toTokenSourceType(
	orchestrator: OrchestratorOperation,
): TokenData["sourceType"] {
	switch (orchestrator) {
		case "manual-send":
			return "manual";
		case "admin-send":
			return "manual";
		case "yoink":
			return "yoink";
		default:
			return "send-train";
	}
}

/**
 * Atomically promote staging entry to permanent storage using Lua script
 * All Redis operations succeed or fail together to prevent partial state
 */
export async function promoteStaging(tokenId: number): Promise<void> {
	const staging = await getStaging(tokenId);
	if (!staging) {
		throw new Error(`No staging entry found for token ${tokenId}`);
	}

	if (staging.status !== "completed") {
		throw new Error(
			`Cannot promote staging entry in status ${staging.status} for token ${tokenId}`,
		);
	}

	assertPromotable(staging);

	const mintedTokenId = staging.tokenId;

	const tokenData: TokenData = {
		tokenId: mintedTokenId,
		imageHash: staging.imageHash,
		metadataHash: staging.metadataHash,
		tokenURI: staging.tokenURI,
		holderAddress: staging.departingPassenger.address,
		holderUsername: staging.departingPassenger.username,
		holderFid: staging.departingPassenger.fid,
		holderDisplayName: staging.departingPassenger.displayName,
		holderPfpUrl: staging.departingPassenger.pfpUrl,
		transactionHash: staging.txHash,
		timestamp: new Date().toISOString(),
		blockNumber: staging.blockNumber,
		attributes: staging.attributes,
		sourceType: toTokenSourceType(staging.orchestrator),
		sourceCastHash: staging.sourceCastHash,
		totalEligibleReactors: staging.totalEligibleReactors,
	};

	const currentHolderData = {
		fid: staging.newHolder.fid,
		username: staging.newHolder.username,
		displayName: staging.newHolder.displayName ?? staging.newHolder.username,
		pfpUrl: staging.newHolder.pfpUrl ?? "",
		address: staging.newHolder.address,
		timestamp: new Date().toISOString(),
	};

	const lastMovedData = {
		timestamp: new Date().toISOString(),
		transactionHash: staging.txHash,
	};

	// Atomic promotion using Lua script
	// All operations succeed or fail together
	const promotionScript = `
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

	try {
		const { REDIS_KEYS } = await import("@/lib/redis-token-utils");

		const result = (await redis.eval(
			promotionScript,
			5,
			REDIS_KEYS.token(mintedTokenId),
			REDIS_KEYS.lastMovedTimestamp,
			CURRENT_HOLDER_KEY,
			getStagingKey(tokenId),
			REDIS_KEYS.currentTokenId,
			JSON.stringify(tokenData),
			JSON.stringify(lastMovedData),
			JSON.stringify(currentHolderData),
			mintedTokenId.toString(),
		)) as string | { err: string };

		// Handle error responses from Lua
		if (typeof result === "object" && result.err) {
			throw new Error(`Promotion failed: ${result.err}`);
		}

		orchestratorLog.info(
			toOrchestratorLogCode(staging.orchestrator, "promotion_store_success"),
			{
				tokenId: mintedTokenId,
				result: result === "created" ? "created" : "exists",
				atomic: true,
			},
		);

		// Publish update notification (best-effort, non-critical)
		await publishCurrentHolderUpdate();

		stagingLog.info("promotion.success", {
			tokenId: mintedTokenId,
		});
	} catch (error) {
		stagingLog.error("promotion.failed", {
			tokenId: mintedTokenId,
			error,
			msg: "Atomic promotion failed",
		});
		throw error;
	}
}

/**
 * List all staging entries using SCAN (non-blocking) and MGET (batch retrieval)
 * Safe for production use with large datasets
 */
export async function listStagingEntries(): Promise<StagingMovement[]> {
	const keys: string[] = [];
	let cursor = "0";

	do {
		try {
			const result = await redis.scan(
				cursor,
				"MATCH",
				`${STAGING_KEY_PREFIX}:*`,
				"COUNT",
				100,
			);

			if (Array.isArray(result) && result.length === 2) {
				cursor = result[0] as string;
				const batch = result[1] as string[];
				keys.push(...batch);
			} else {
				stagingLog.warn("listing.failed", {
					msg: "Unexpected SCAN result format",
					result,
				});
				break;
			}
		} catch (error) {
			stagingLog.error("listing.failed", {
				error,
				msg: "SCAN operation failed",
			});
			break;
		}
	} while (cursor !== "0");

	if (keys.length === 0) return [];

	// Use MGET for batch retrieval instead of individual GETs
	const entries: StagingMovement[] = [];
	const batchSize = 100;

	for (let i = 0; i < keys.length; i += batchSize) {
		const batch = keys.slice(i, i + batchSize);

		try {
			const values = await redis.mget(...batch);

			for (let j = 0; j < values.length; j++) {
				const data = values[j];
				if (!data) continue;

				try {
					const parsed = JSON.parse(data) as StagingMovement;
					entries.push(parsed);
				} catch (error) {
					stagingLog.error("listing.parse_failed", {
						key: batch[j],
						error,
					});
				}
			}
		} catch (error) {
			stagingLog.error("listing.failed", {
				error,
				msg: "MGET operation failed",
				batchStart: i,
				batchSize: batch.length,
			});
		}
	}

	return entries.sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);
}

export function isStagingStuck(
	staging: StagingMovement,
	thresholdMs: number,
): boolean {
	const age = Date.now() - new Date(staging.createdAt).getTime();
	return age > thresholdMs && staging.status !== "completed";
}
