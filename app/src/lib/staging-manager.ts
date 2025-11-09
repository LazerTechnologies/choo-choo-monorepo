import {
	type OrchestratorOperation,
	orchestratorLog,
	redisLog,
	stagingLog,
	toOrchestratorLogCode,
} from "@/lib/event-log";
import { CURRENT_HOLDER_KEY, redis } from "@/lib/kv";
import {
	storeLastMovedTimestamp,
	storeTokenDataWriteOnce,
} from "@/lib/redis-token-utils";
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
	lastError?: string;
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

async function writeStaging(
	key: string,
	payload: StagingMovement,
): Promise<void> {
	const client = redis as unknown as RedisWithSetOptions;
	await client.set(key, JSON.stringify(payload), "EX", STAGING_TTL_SECONDS);
}

export async function createStaging(
	tokenId: number,
	staging: Omit<
		StagingMovement,
		"tokenId" | "status" | "createdAt" | "retryCount"
	>,
): Promise<void> {
	const key = getStagingKey(tokenId);
	const existing = await redis.get(key);
	if (existing) {
		stagingLog.warn("lifecycle.exists", {
			tokenId,
			msg: "Staging already exists, skipping creation",
		});
		return;
	}

	const payload: StagingMovement = {
		tokenId,
		status: "preparing",
		createdAt: new Date().toISOString(),
		retryCount: 0,
		...staging,
	};

	await writeStaging(key, payload);

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
	updates: Partial<Omit<StagingMovement, "tokenId" | "createdAt">>,
): Promise<StagingMovement | null> {
	const key = getStagingKey(tokenId);
	const current = await getStaging(tokenId);
	if (!current) return null;

	const next: StagingMovement = {
		...current,
		...updates,
		tokenId,
	};

	await writeStaging(key, next);

	stagingLog.info("lifecycle.updated", {
		tokenId,
		status: next.status,
	});

	return next;
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

	const tokenData: TokenData = {
		tokenId,
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

	const result = await storeTokenDataWriteOnce(tokenData);
	orchestratorLog.info(
		toOrchestratorLogCode(staging.orchestrator, "promotion_store_success"),
		{
			tokenId,
			result,
		},
	);

	try {
		await storeLastMovedTimestamp(tokenId, staging.txHash);
	} catch (error) {
		redisLog.warn("set.failed", {
			tokenId,
			error,
			context: "last-moved-timestamp",
		});
	}

	const currentHolderData = {
		fid: staging.newHolder.fid,
		username: staging.newHolder.username,
		displayName: staging.newHolder.displayName ?? staging.newHolder.username,
		pfpUrl: staging.newHolder.pfpUrl ?? "",
		address: staging.newHolder.address,
		timestamp: new Date().toISOString(),
	};

	await redis.set(CURRENT_HOLDER_KEY, JSON.stringify(currentHolderData));
	await publishCurrentHolderUpdate();

	await redis.del(getStagingKey(tokenId));

	stagingLog.info("promotion.success", {
		tokenId,
	});
}

export async function listStagingEntries(): Promise<StagingMovement[]> {
	const keys = await redis.keys(`${STAGING_KEY_PREFIX}:*`);
	if (keys.length === 0) return [];

	const entries: StagingMovement[] = [];
	for (const key of keys) {
		const data = await redis.get(key);
		if (!data) continue;

		try {
			const parsed = JSON.parse(data) as StagingMovement;
			entries.push(parsed);
		} catch (error) {
			stagingLog.error("listing.parse_failed", {
				key,
				error,
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
