import { APP_URL } from "@/lib/constants";
import {
	contractLog,
	type OrchestratorOperation,
	orchestratorLog,
	redisLog,
	toOrchestratorLogCode,
} from "@/lib/event-log";
import { redis } from "@/lib/kv";
import { sendChooChooNotification } from "@/lib/notifications";
import {
	acquireLock,
	getOrSetPendingGeneration,
	REDIS_KEYS,
	releaseLock,
} from "@/lib/redis-token-utils";
import { retryWithBackoff } from "@/lib/retry-utils";
import { getContractService } from "@/lib/services/contract";
import {
	checkNeynarScore,
	MIN_NEYNAR_SCORE,
} from "@/lib/services/neynar-score";
import {
	abandonStaging,
	createStaging,
	getStaging,
	isStagingStuck,
	promoteStaging,
	updateStaging,
} from "@/lib/staging-manager";

const TRAIN_MOVEMENT_LOCK_KEY = "lock:train:movement";

/**
 * Verifies that the contract's nextTicketId has advanced correctly after minting.
 * Now tolerant of the actual minted token ID since we get it from transaction receipt.
 * Logs a warning if the verification fails but does not throw (non-critical).
 *
 * @param contractService - The contract service instance
 * @param mintedTokenId - The actual minted token ID (from transaction receipt)
 * @param context - Context string for logging (e.g., 'train-orchestrator', 'orchestrateYoink')
 */
async function verifyNextIdAdvanced(
	contractService: ReturnType<typeof getContractService>,
	mintedTokenId: number,
	context: string,
): Promise<void> {
	try {
		const postNextId = await contractService.getNextOnChainTicketId();
		// The next ID should be at least one more than the minted token ID
		// This is more tolerant since we're using the authoritative minted ID
		if (postNextId <= mintedTokenId) {
			console.warn(
				`[${context}] Contract nextTicketId verification: expected > ${mintedTokenId}, got ${postNextId}`,
			);
		} else {
			console.log(
				`[${context}] Contract nextTicketId verification passed: ${postNextId} > ${mintedTokenId}`,
			);
		}
	} catch (err) {
		console.warn(
			`[${context}] Failed to verify post-mint contract state (non-critical):`,
			err,
		);
	}
}

export interface PassengerData {
	username: string;
	fid: number;
	displayName: string;
	pfpUrl: string;
	address: string;
}

export interface TrainMovementRequest {
	newHolder: PassengerData;
	departingPassenger: PassengerData;
	sourceCastHash?: string;
	totalEligibleReactors?: number;
	sourceType: "send-train" | "user-send-train" | "admin-send-train" | "yoink";
}

export interface TrainMovementResult {
	success: boolean;
	tokenId: number;
	txHash: string;
	tokenURI: string;
	error?: string;
}

type NFTAttribute = { trait_type: string; value: string | number };

interface PreparedNFTData {
	imageHash: string;
	metadataHash: string;
	tokenURI: `ipfs://${string}`;
	attributes: NFTAttribute[];
}

interface ParticipantSnapshot {
	fid: number;
	username: string;
	displayName?: string;
	pfpUrl?: string;
	address: string;
}

interface ExecuteTrainMovementOptions {
	operation: OrchestratorOperation;
	tokenId: number;
	preparedNFT: PreparedNFTData;
	contractService: ReturnType<typeof getContractService>;
	contractOperation: () => Promise<{
		txHash: string;
		actualTokenId?: number;
		blockNumber?: number;
	}>;
	metadataOperation?: (actualTokenId: number) => Promise<void>;
	needsMetadataOnchain?: boolean;
	newHolder: ParticipantSnapshot;
	departingPassenger: ParticipantSnapshot;
	sourceCastHash?: string;
	totalEligibleReactors?: number;
}

const STAGING_TIMEOUT_MS = 10 * 60 * 1000;

export async function executeTrainMovement(
	options: ExecuteTrainMovementOptions,
): Promise<TrainMovementResult> {
	const {
		operation,
		tokenId: initialTokenId,
		preparedNFT,
		contractService,
		contractOperation,
		metadataOperation,
		needsMetadataOnchain = false,
		newHolder,
		departingPassenger,
		sourceCastHash,
		totalEligibleReactors,
	} = options;

	orchestratorLog.info(toOrchestratorLogCode(operation, "start"), {
		tokenId: initialTokenId,
		newHolder: newHolder.username,
		departingPassenger: departingPassenger.username,
	});

	const existingStaging = await getStaging(initialTokenId);
	if (existingStaging) {
		if (existingStaging.status === "completed") {
			orchestratorLog.info(
				toOrchestratorLogCode(operation, "staging_updated"),
				{
					tokenId: initialTokenId,
					status: existingStaging.status,
				},
			);

			try {
				await retryWithBackoff(
					() => promoteStaging(initialTokenId),
					`promote-staging-${initialTokenId}`,
					5,
				);
			} catch (error) {
				orchestratorLog.error(
					toOrchestratorLogCode(operation, "promotion_failed"),
					{ tokenId: initialTokenId, error },
				);
				return {
					success: false,
					tokenId: initialTokenId,
					txHash: "",
					tokenURI: "",
					error:
						error instanceof Error
							? error.message
							: "Failed to promote completed staging entry",
				};
			}

			return {
				success: true,
				tokenId: existingStaging.tokenId ?? initialTokenId,
				txHash: existingStaging.txHash ?? "",
				tokenURI: existingStaging.tokenURI ?? preparedNFT.tokenURI,
			};
		}

		const stuck = isStagingStuck(existingStaging, STAGING_TIMEOUT_MS);
		if (!stuck) {
			return {
				success: false,
				tokenId: initialTokenId,
				txHash: "",
				tokenURI: "",
				error: "Train movement already in progress",
			};
		}

		await abandonStaging(initialTokenId, "Staging timed out - restarting");
	}

	try {
		await createStaging(initialTokenId, {
			orchestrator: operation,
			newHolder,
			departingPassenger,
			sourceCastHash,
			totalEligibleReactors,
		});

		await updateStaging(initialTokenId, {
			status: "pinata_uploaded",
			imageHash: preparedNFT.imageHash,
			metadataHash: preparedNFT.metadataHash,
			tokenURI: preparedNFT.tokenURI,
			attributes: preparedNFT.attributes,
		});

		let mintedTokenId = initialTokenId;
		let txHash: string;
		let blockNumber: number | undefined;

		try {
			const contractResult = await retryWithBackoff(
				contractOperation,
				`contract-${operation}-${initialTokenId}`,
				2,
			);
			txHash = contractResult.txHash;
			mintedTokenId = contractResult.actualTokenId ?? initialTokenId;
			blockNumber = contractResult.blockNumber;

			orchestratorLog.info(
				toOrchestratorLogCode(operation, "contract_confirmed"),
				{
					tokenId: mintedTokenId,
					txHash,
				},
			);
		} catch (error) {
			await abandonStaging(
				initialTokenId,
				error instanceof Error ? error.message : "Contract execution failed",
			);
			try {
				await redis.del(REDIS_KEYS.pendingNFT(initialTokenId));
				redisLog.info("del.success", {
					key: REDIS_KEYS.pendingNFT(initialTokenId),
					context: "pending-nft",
				});
			} catch (cleanupError) {
				redisLog.warn("del.failed", {
					key: REDIS_KEYS.pendingNFT(initialTokenId),
					error: cleanupError,
				});
			}

			return {
				success: false,
				tokenId: initialTokenId,
				txHash: "",
				tokenURI: "",
				error:
					error instanceof Error ? error.message : "Failed to execute contract",
			};
		}

		await updateStaging(initialTokenId, {
			status: needsMetadataOnchain ? "minted" : "metadata_set",
			txHash,
			blockNumber,
			tokenId: mintedTokenId,
		});

		if (needsMetadataOnchain && metadataOperation) {
			try {
				await retryWithBackoff(
					() => metadataOperation(mintedTokenId),
					`metadata-${operation}-${mintedTokenId}`,
					3,
				);
				orchestratorLog.info(toOrchestratorLogCode(operation, "metadata_set"), {
					tokenId: mintedTokenId,
				});
				await updateStaging(initialTokenId, { status: "metadata_set" });
			} catch (error) {
				orchestratorLog.error(
					toOrchestratorLogCode(operation, "metadata_set"),
					{
						tokenId: mintedTokenId,
						error,
					},
				);
			}
		}

		await updateStaging(initialTokenId, { status: "completed" });

		try {
			await retryWithBackoff(
				() => promoteStaging(initialTokenId),
				`promote-staging-${mintedTokenId}`,
				5,
			);
		} catch (error) {
			orchestratorLog.error(
				toOrchestratorLogCode(operation, "promotion_failed"),
				{
					tokenId: mintedTokenId,
					error,
				},
			);
			return {
				success: false,
				tokenId: mintedTokenId,
				txHash,
				tokenURI: preparedNFT.tokenURI,
				error:
					error instanceof Error
						? error.message
						: "Failed to promote staging entry",
			};
		}

		try {
			await redis.del(REDIS_KEYS.pendingNFT(mintedTokenId));
			redisLog.info("del.success", {
				key: REDIS_KEYS.pendingNFT(mintedTokenId),
				context: "pending-nft",
			});
		} catch (cleanupError) {
			redisLog.warn("del.failed", {
				key: REDIS_KEYS.pendingNFT(mintedTokenId),
				error: cleanupError,
			});
		}

		try {
			await verifyNextIdAdvanced(
				contractService,
				mintedTokenId,
				`orchestrator-${operation}`,
			);
		} catch (verifyError) {
			contractLog.warn("verify.failed", {
				tokenId: mintedTokenId,
				error: verifyError,
			});
		}

		orchestratorLog.info(toOrchestratorLogCode(operation, "completed"), {
			tokenId: mintedTokenId,
			txHash,
		});

		return {
			success: true,
			tokenId: mintedTokenId,
			txHash,
			tokenURI: preparedNFT.tokenURI,
		};
	} catch (error) {
		orchestratorLog.error(toOrchestratorLogCode(operation, "failed"), {
			tokenId: initialTokenId,
			error,
		});

		return {
			success: false,
			tokenId: initialTokenId,
			txHash: "",
			tokenURI: "",
			error: error instanceof Error ? error.message : "Train movement failed",
		};
	}
}

/**
 * Manual send orchestrator using prepare-then-commit pattern
 *
 * This function implements a multi-phase approach with pre-flight validation:
 * 1. Pre-Flight Phase: Validate contract conditions BEFORE generating NFT (prevents wasteful Pinata uploads)
 * 2. Preparation Phase: Generate NFT and upload to Pinata (cached in Redis for idempotency)
 * 3. Commit Phase: Execute blockchain transaction (point of no return, waits for confirmation)
 * 4. Post-Commit Phase: Update app state with prepared data (should rarely fail)
 * 5. Cleanup on Error: Clear pending cache if commit fails (allows retry with regeneration)
 *
 * ARCHITECTURE NOTE: Pinata uploads cannot be rolled back. If a mint fails after upload,
 * the data remains on IPFS. However, we clear the Redis cache to allow regeneration on retry.
 * The pre-flight validation minimizes this by catching contract rejections before upload.
 */
export async function orchestrateManualSend(
	currentHolderFid: number,
	targetFid: number,
	skipNeynarScoreCheck = false,
) {
	const globalLockKey = TRAIN_MOVEMENT_LOCK_KEY;
	const lockKey = `lock:manual:${currentHolderFid}:${targetFid}`;
	const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

	orchestratorLog.info(toOrchestratorLogCode("manual-send", "start"), {
		currentHolderFid,
		targetFid,
	});

	/**  @dev degens spawn camp yoink, need to serialize all movements */
	const lockedGlobal = await acquireLock(globalLockKey, 40_000);
	if (!lockedGlobal) {
		orchestratorLog.warn(toOrchestratorLogCode("manual-send", "failed"), {
			reason: "global_lock_unavailable",
		});
		return {
			status: 409,
			body: { success: false, error: "Another train movement is in progress" },
		} as const;
	}

	/**  @dev dedupe manual sends */
	const locked = await acquireLock(lockKey, 30_000);
	if (!locked) {
		orchestratorLog.warn(toOrchestratorLogCode("manual-send", "failed"), {
			reason: "dedupe_lock_unavailable",
		});
		await releaseLock(globalLockKey);
		return {
			status: 409,
			body: { success: false, error: "Manual send already in progress" },
		} as const;
	}

	try {
		const contractService = getContractService();
		const nextTokenId = await contractService.getNextOnChainTicketId();

		// Resolve departing passenger (current holder) + target from external sources
		const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
		if (!currentHolderRes.ok) throw new Error("Failed to fetch current holder");
		const departingPassengerData = await currentHolderRes.json();

		const winnerRes = await fetch(
			`https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}`,
			{
				headers: {
					accept: "application/json",
					"x-api-key": process.env.NEYNAR_API_KEY || "",
				},
			},
		);
		if (!winnerRes.ok) throw new Error("Failed to fetch target user");
		const winnerJson = await winnerRes.json();
		const user = winnerJson?.users?.[0];
		if (!user) throw new Error("Target user not found");
		const targetAddress =
			user.verified_addresses?.primary?.eth_address ||
			user.verified_addresses?.eth_addresses?.[0];
		if (!targetAddress) throw new Error("Target user missing address");

		const hasRidden = await contractService.hasBeenPassenger(
			targetAddress as `0x${string}`,
		);
		if (hasRidden) {
			throw new Error(
				`Target user ${user.username} (${targetAddress}) has already ridden the train and cannot receive it again`,
			);
		}

		// Check if trying to send to current holder
		const currentContractHolder = await contractService.getCurrentTrainHolder();
		if (currentContractHolder.toLowerCase() === targetAddress.toLowerCase()) {
			throw new Error(
				`Cannot send train to current holder ${user.username} (${targetAddress})`,
			);
		}

		orchestratorLog.info(
			toOrchestratorLogCode("manual-send", "staging_updated"),
			{
				tokenId: nextTokenId,
				stage: "preflight_passed",
			},
		);

		if (!skipNeynarScoreCheck) {
			const targetScoreCheck = await checkNeynarScore(targetFid);
			if (!targetScoreCheck.meetsMinimum) {
				throw new Error(
					`Target user must have a Neynar score of at least ${MIN_NEYNAR_SCORE} to receive ChooChoo (current score: ${targetScoreCheck.score})`,
				);
			}
		} else {
			orchestratorLog.info(
				toOrchestratorLogCode("manual-send", "staging_updated"),
				{
					tokenId: nextTokenId,
					stage: "score_check_skipped",
				},
			);
		}

		// Get departing passenger address for NFT ticket holder
		let departingPassengerAddress =
			departingPassengerData.currentHolder?.address;
		if (!departingPassengerAddress) {
			// Fallback: fetch from Neynar if not in Redis current-holder
			const departingRes = await fetch(
				`https://api.neynar.com/v2/farcaster/user/bulk?fids=${currentHolderFid}`,
				{
					headers: {
						accept: "application/json",
						"x-api-key": process.env.NEYNAR_API_KEY || "",
					},
				},
			);
			if (departingRes.ok) {
				const departingJson = await departingRes.json();
				const departingUser = departingJson?.users?.[0];
				departingPassengerAddress =
					departingUser?.verified_addresses?.primary?.eth_address ||
					departingUser?.verified_addresses?.eth_addresses?.[0];
			}
		}
		if (!departingPassengerAddress)
			throw new Error("Departing passenger missing address");

		const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
			const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					tokenId: nextTokenId,
					passengerUsername: departingPassengerData.currentHolder.username,
				}),
			});
			if (!genRes.ok) throw new Error("generate-nft failed");
			const gen = await genRes.json();
			return {
				imageHash: gen.imageHash,
				metadataHash: gen.metadataHash,
				tokenURI: gen.tokenURI,
				attributes: gen.metadata?.attributes || [],
				passengerUsername: departingPassengerData.currentHolder.username,
			};
		});

		const preparedNFTData: PreparedNFTData = {
			imageHash: pending.imageHash,
			metadataHash: pending.metadataHash,
			tokenURI: pending.tokenURI,
			attributes: pending.attributes,
		};

		const movement = await executeTrainMovement({
			operation: "manual-send",
			tokenId: nextTokenId,
			preparedNFT: preparedNFTData,
			contractService,
			newHolder: {
				fid: user.fid,
				username: user.username,
				displayName: user.display_name,
				pfpUrl: user.pfp_url,
				address: targetAddress,
			},
			departingPassenger: {
				fid: departingPassengerData.currentHolder.fid,
				username: departingPassengerData.currentHolder.username,
				displayName: departingPassengerData.currentHolder.displayName,
				pfpUrl: departingPassengerData.currentHolder.pfpUrl,
				address: departingPassengerAddress,
			},
			sourceCastHash: undefined,
			totalEligibleReactors: 1,
			contractOperation: async () => {
				const mintRes = await fetch(`${APP_URL}/api/internal/mint-token`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-internal-secret": INTERNAL_SECRET,
					},
					body: JSON.stringify({
						newHolderAddress: targetAddress,
						tokenURI: pending.tokenURI,
						newHolderData: {
							username: user.username,
							fid: user.fid,
							displayName: user.display_name,
							pfpUrl: user.pfp_url,
						},
						previousHolderData: {
							username: departingPassengerData.currentHolder.username,
							fid: departingPassengerData.currentHolder.fid,
							displayName: departingPassengerData.currentHolder.displayName,
							pfpUrl: departingPassengerData.currentHolder.pfpUrl,
						},
						sourceCastHash: undefined,
						totalEligibleReactors: 1,
					}),
				});

				if (!mintRes.ok) {
					const errText = await mintRes.text();
					throw new Error(`mint-token failed: ${errText}`);
				}

				const mintJson = await mintRes.json();
				if (!mintJson.success) {
					throw new Error(
						`Token minting failed: ${mintJson.error || "Unknown error"}`,
					);
				}

				return {
					txHash: mintJson.txHash,
					actualTokenId: mintJson.actualTokenId ?? nextTokenId,
				};
			},
		});

		if (!movement.success) {
			orchestratorLog.error(toOrchestratorLogCode("manual-send", "failed"), {
				tokenId: nextTokenId,
				error: movement.error,
			});
			return {
				status: 500,
				body: {
					success: false,
					error: movement.error ?? "Manual send failed",
				},
			} as const;
		}

		const winnerInfo = {
			username: user.username,
			fid: user.fid,
			displayName: user.display_name,
			pfpUrl: user.pfp_url,
			address: targetAddress,
		};

		const timestamp = Date.now();
		try {
			// Welcome cast for new holder
			const welcomeResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🚂 ChooChoo is heading to @${user.username}!`,
					embeds: [{ url: APP_URL }],
					idem: `welcome-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!welcomeResponse.ok) {
				const errorData = await welcomeResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("manual-send", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "welcome_cast",
						status: welcomeResponse.status,
						error: errorData.error,
					},
				);
			}

			// Ticket issued cast for departing passenger with image
			const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${pending.imageHash}`;
			const ticketResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🎫 Ticket #${movement.tokenId} minted to @${departingPassengerData.currentHolder.username}!`,
					embeds: [{ url: imageUrl }],
					idem: `ticket-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!ticketResponse.ok) {
				const errorData = await ticketResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("manual-send", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "ticket_cast",
						status: ticketResponse.status,
						error: errorData.error,
					},
				);
			}
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("manual-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "cast_requests",
					error: err,
				},
			);
		}

		// 9) Send notifications
		try {
			// Notify new holder that ChooChoo has arrived
			await sendChooChooNotification(
				"chooChooArrived",
				user.username,
				user.fid,
			);

			// Notify departing passenger about their ticket NFT
			await sendChooChooNotification(
				"ticketMinted",
				departingPassengerData.currentHolder.username,
				movement.tokenId,
				departingPassengerData.currentHolder.fid,
			);
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("manual-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "notifications",
					error: err,
				},
			);
		}

		// 10) Workflow state: set NOT_CASTED for new holder; clear prior cast metadata
		try {
			await fetch(`${APP_URL}/api/workflow-state`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					state: "NOT_CASTED",
					winnerSelectionStart: null,
					currentCastHash: null,
				}),
			});
		} catch (workflowError) {
			orchestratorLog.warn(
				toOrchestratorLogCode("manual-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "workflow_state",
					error: workflowError,
				},
			);
		}

		return {
			status: 200,
			body: {
				success: true,
				winner: winnerInfo,
				tokenId: movement.tokenId,
				txHash: movement.txHash,
				tokenURI: movement.tokenURI,
			},
		} as const;
	} catch (error) {
		orchestratorLog.error(toOrchestratorLogCode("manual-send", "failed"), {
			currentHolderFid,
			targetFid,
			error,
		});
		return {
			status: 500,
			body: { success: false, error: (error as Error).message },
		} as const;
	} finally {
		/**  @dev release locks */
		await releaseLock(lockKey);
		await releaseLock(globalLockKey);
	}
}

/**
 * Random winner orchestrator with single-writer semantics and idempotency.
 * Used for public chance mode - selects random winner from cast reactions.
 */
export async function orchestrateRandomSend(castHash: string) {
	const globalLockKey = TRAIN_MOVEMENT_LOCK_KEY;
	const lockKey = `lock:random:${castHash}`;
	const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

	orchestratorLog.info(toOrchestratorLogCode("random-send", "start"), {
		castHash,
	});

	const lockedGlobal = await acquireLock(globalLockKey, 40_000);
	if (!lockedGlobal) {
		orchestratorLog.warn(toOrchestratorLogCode("random-send", "failed"), {
			reason: "global_lock_unavailable",
			castHash,
		});
		return {
			status: 409,
			body: { success: false, error: "Another train movement is in progress" },
		} as const;
	}

	const locked = await acquireLock(lockKey, 30_000);
	if (!locked) {
		orchestratorLog.warn(toOrchestratorLogCode("random-send", "failed"), {
			reason: "dedupe_lock_unavailable",
			castHash,
		});
		await releaseLock(globalLockKey);
		return {
			status: 409,
			body: { success: false, error: "Random send already in progress" },
		} as const;
	}

	try {
		const contractService = getContractService();
		const nextTokenId = await contractService.getNextOnChainTicketId();

		const winnerRes = await fetch(`${APP_URL}/api/internal/select-winner`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-internal-secret": INTERNAL_SECRET,
			},
			body: JSON.stringify({ castHash }),
		});
		if (!winnerRes.ok) throw new Error("Winner selection failed");
		const winnerData = await winnerRes.json();
		if (!winnerData.success)
			throw new Error(winnerData.error || "Winner selection failed");

		const winnerScoreCheck = await checkNeynarScore(winnerData.winner.fid);
		if (!winnerScoreCheck.meetsMinimum) {
			throw new Error(
				`Selected winner does not meet the minimum Neynar score requirement (score: ${winnerScoreCheck.score})`,
			);
		}

		const hasRidden = await contractService.hasBeenPassenger(
			winnerData.winner.address as `0x${string}`,
		);
		if (hasRidden) {
			throw new Error(
				`Winner ${winnerData.winner.username} (${winnerData.winner.address}) has already ridden the train. Selecting a new winner is required.`,
			);
		}

		// Check if trying to send to current holder
		const currentContractHolder = await contractService.getCurrentTrainHolder();
		if (
			currentContractHolder.toLowerCase() ===
			winnerData.winner.address.toLowerCase()
		) {
			throw new Error(
				`Cannot send train to current holder ${winnerData.winner.username} (${winnerData.winner.address})`,
			);
		}

		const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
		if (!currentHolderRes.ok) throw new Error("Failed to fetch current holder");
		const departingPassengerData = await currentHolderRes.json();
		if (!departingPassengerData.hasCurrentHolder)
			throw new Error("No current holder found");

		// Get departing passenger address for NFT ticket holder
		let departingPassengerAddress =
			departingPassengerData.currentHolder?.address;
		if (!departingPassengerAddress) {
			// Fallback: fetch from Neynar if not in Redis current-holder
			const departingRes = await fetch(
				`https://api.neynar.com/v2/farcaster/user/bulk?fids=${departingPassengerData.currentHolder.fid}`,
				{
					headers: {
						accept: "application/json",
						"x-api-key": process.env.NEYNAR_API_KEY || "",
					},
				},
			);
			if (departingRes.ok) {
				const departingJson = await departingRes.json();
				const departingUser = departingJson?.users?.[0];
				departingPassengerAddress =
					departingUser?.verified_addresses?.primary?.eth_address ||
					departingUser?.verified_addresses?.eth_addresses?.[0];
			}
		}
		if (!departingPassengerAddress)
			throw new Error("Departing passenger missing address");

		const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
			const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					tokenId: nextTokenId,
					passengerUsername: departingPassengerData.currentHolder.username,
				}),
			});
			if (!genRes.ok) throw new Error("generate-nft failed");
			const gen = await genRes.json();
			return {
				imageHash: gen.imageHash,
				metadataHash: gen.metadataHash,
				tokenURI: gen.tokenURI,
				attributes: gen.metadata?.attributes || [],
				passengerUsername: departingPassengerData.currentHolder.username,
			};
		});

		const preparedNFTData: PreparedNFTData = {
			imageHash: pending.imageHash,
			metadataHash: pending.metadataHash,
			tokenURI: pending.tokenURI,
			attributes: pending.attributes,
		};

		const movement = await executeTrainMovement({
			operation: "random-send",
			tokenId: nextTokenId,
			preparedNFT: preparedNFTData,
			contractService,
			newHolder: {
				fid: winnerData.winner.fid,
				username: winnerData.winner.username,
				displayName: winnerData.winner.displayName,
				pfpUrl: winnerData.winner.pfpUrl,
				address: winnerData.winner.address,
			},
			departingPassenger: {
				fid: departingPassengerData.currentHolder.fid,
				username: departingPassengerData.currentHolder.username,
				displayName: departingPassengerData.currentHolder.displayName,
				pfpUrl: departingPassengerData.currentHolder.pfpUrl,
				address: departingPassengerAddress,
			},
			sourceCastHash: castHash,
			totalEligibleReactors: winnerData.totalEligibleReactors,
			contractOperation: async () => {
				const mintRes = await fetch(`${APP_URL}/api/internal/mint-token`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-internal-secret": INTERNAL_SECRET,
					},
					body: JSON.stringify({
						newHolderAddress: winnerData.winner.address,
						tokenURI: pending.tokenURI,
						newHolderData: winnerData.winner,
						previousHolderData: {
							username: departingPassengerData.currentHolder.username,
							fid: departingPassengerData.currentHolder.fid,
							displayName: departingPassengerData.currentHolder.displayName,
							pfpUrl: departingPassengerData.currentHolder.pfpUrl,
						},
						sourceCastHash: castHash,
						totalEligibleReactors: winnerData.totalEligibleReactors,
					}),
				});

				if (!mintRes.ok) {
					const errText = await mintRes.text();
					throw new Error(`mint-token failed: ${errText}`);
				}

				const mintJson = await mintRes.json();
				if (!mintJson.success) {
					throw new Error(
						`Token minting failed: ${mintJson.error || "Unknown error"}`,
					);
				}

				return {
					txHash: mintJson.txHash,
					actualTokenId: mintJson.actualTokenId ?? nextTokenId,
				};
			},
		});

		if (!movement.success) {
			orchestratorLog.error(toOrchestratorLogCode("random-send", "failed"), {
				tokenId: nextTokenId,
				error: movement.error,
			});
			return {
				status: 500,
				body: { success: false, error: movement.error ?? "Random send failed" },
			} as const;
		}

		const timestamp = Date.now();
		try {
			// Welcome cast for new holder
			const welcomeResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🚂 ChooChoo is heading to @${winnerData.winner.username}!`,
					embeds: [{ url: APP_URL }],
					idem: `welcome-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!welcomeResponse.ok) {
				const errorData = await welcomeResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("random-send", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "welcome_cast",
						status: welcomeResponse.status,
						error: errorData.error,
					},
				);
			}

			// Ticket issued cast for departing passenger with image
			const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${pending.imageHash}`;
			const ticketResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🎫 Ticket #${movement.tokenId} minted to @${departingPassengerData.currentHolder.username}!`,
					embeds: [{ url: imageUrl }],
					idem: `ticket-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!ticketResponse.ok) {
				const errorData = await ticketResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("random-send", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "ticket_cast",
						status: ticketResponse.status,
						error: errorData.error,
					},
				);
			}
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("random-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "cast_requests",
					error: err,
				},
			);
		}

		try {
			// Notify new holder that ChooChoo has arrived
			await sendChooChooNotification(
				"chooChooArrived",
				winnerData.winner.username,
				winnerData.winner.fid,
			);

			// Notify departing passenger about their ticket NFT
			await sendChooChooNotification(
				"ticketMinted",
				departingPassengerData.currentHolder.username,
				movement.tokenId,
				departingPassengerData.currentHolder.fid,
			);
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("random-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "notifications",
					error: err,
				},
			);
		}

		try {
			await fetch(`${APP_URL}/api/workflow-state`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					state: "NOT_CASTED",
					winnerSelectionStart: null,
					currentCastHash: null,
				}),
			});
		} catch (workflowError) {
			orchestratorLog.warn(
				toOrchestratorLogCode("random-send", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "workflow_state",
					error: workflowError,
				},
			);
		}

		return {
			status: 200,
			body: {
				success: true,
				tokenId: movement.tokenId,
				txHash: movement.txHash,
				tokenURI: movement.tokenURI,
				winner: winnerData.winner,
				totalEligibleReactors: winnerData.totalEligibleReactors,
			},
		} as const;
	} catch (error) {
		orchestratorLog.error(toOrchestratorLogCode("random-send", "failed"), {
			castHash,
			error,
		});
		return {
			status: 500,
			body: { success: false, error: (error as Error).message },
		} as const;
	} finally {
		// 13) Release locks
		await releaseLock(lockKey);
		await releaseLock(globalLockKey);
	}
}

/**
 * Yoink orchestrator with single-writer semantics and idempotency.
 * Used for yoink operations - allows users to yoink the train if conditions are met.
 */
export async function orchestrateYoink(userFid: number, targetAddress: string) {
	const globalLockKey = TRAIN_MOVEMENT_LOCK_KEY;
	const lockKey = `lock:yoink:${userFid}:${targetAddress}`;
	const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

	orchestratorLog.info(toOrchestratorLogCode("yoink", "start"), {
		userFid,
		targetAddress,
	});

	const lockedGlobal = await acquireLock(globalLockKey, 40_000);
	if (!lockedGlobal) {
		orchestratorLog.warn(toOrchestratorLogCode("yoink", "failed"), {
			reason: "global_lock_unavailable",
			userFid,
		});
		return {
			status: 409,
			body: { success: false, error: "Another train movement is in progress" },
		} as const;
	}

	const locked = await acquireLock(lockKey, 30_000);
	if (!locked) {
		orchestratorLog.warn(toOrchestratorLogCode("yoink", "failed"), {
			reason: "dedupe_lock_unavailable",
			userFid,
		});
		await releaseLock(globalLockKey);
		return {
			status: 409,
			body: { success: false, error: "Yoink already in progress" },
		} as const;
	}

	try {
		const contractService = getContractService();

		const yoinkStatus = await contractService.isYoinkable();
		if (!yoinkStatus.canYoink) {
			throw new Error(`Yoink not available: ${yoinkStatus.reason}`);
		}

		const hasRidden = await contractService.hasBeenPassenger(
			targetAddress as `0x${string}`,
		);
		if (hasRidden) {
			throw new Error("Target address has already ridden the train");
		}

		const hasDeposited = await contractService.hasDepositedEnough(userFid);
		if (!hasDeposited) {
			throw new Error(
				"Insufficient USDC deposit. You must deposit at least 1 USDC to yoink.",
			);
		}

		// Check yoinker's Neynar score
		const yoinkScoreCheck = await checkNeynarScore(userFid);
		if (!yoinkScoreCheck.meetsMinimum) {
			throw new Error(
				`You must have a Neynar score of at least ${MIN_NEYNAR_SCORE} to yoink ChooChoo (current score: ${yoinkScoreCheck.score})`,
			);
		}

		const nextTokenId = await contractService.getNextOnChainTicketId();

		const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
		if (!currentHolderRes.ok) throw new Error("Failed to fetch current holder");
		const departingPassengerData = await currentHolderRes.json();
		if (!departingPassengerData.hasCurrentHolder)
			throw new Error("No current holder found");

		const yoinkerRes = await fetch(
			`https://api.neynar.com/v2/farcaster/user/bulk?fids=${userFid}`,
			{
				headers: {
					accept: "application/json",
					"x-api-key": process.env.NEYNAR_API_KEY || "",
				},
			},
		);
		if (!yoinkerRes.ok) throw new Error("Failed to fetch yoinker user data");
		const yoinkerJson = await yoinkerRes.json();
		const yoinkerUser = yoinkerJson?.users?.[0];
		if (!yoinkerUser) throw new Error("Yoinker user not found");

		const yoinkerData = {
			fid: yoinkerUser.fid,
			username: yoinkerUser.username,
			displayName: yoinkerUser.display_name,
			pfpUrl: yoinkerUser.pfp_url,
		};

		let departingPassengerAddress =
			departingPassengerData.currentHolder?.address;
		if (!departingPassengerAddress) {
			const departingRes = await fetch(
				`https://api.neynar.com/v2/farcaster/user/bulk?fids=${departingPassengerData.currentHolder.fid}`,
				{
					headers: {
						accept: "application/json",
						"x-api-key": process.env.NEYNAR_API_KEY || "",
					},
				},
			);
			if (departingRes.ok) {
				const departingJson = await departingRes.json();
				const departingUser = departingJson?.users?.[0];
				departingPassengerAddress =
					departingUser?.verified_addresses?.primary?.eth_address ||
					departingUser?.verified_addresses?.eth_addresses?.[0];
			}
		}
		if (!departingPassengerAddress)
			throw new Error("Departing passenger missing address");

		const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
			const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					tokenId: nextTokenId,
					passengerUsername: departingPassengerData.currentHolder.username,
				}),
			});
			if (!genRes.ok) throw new Error("generate-nft failed");
			const gen = await genRes.json();
			return {
				imageHash: gen.imageHash,
				metadataHash: gen.metadataHash,
				tokenURI: gen.tokenURI,
				attributes: gen.metadata?.attributes || [],
				passengerUsername: departingPassengerData.currentHolder.username,
			};
		});

		const preparedNFTData: PreparedNFTData = {
			imageHash: pending.imageHash,
			metadataHash: pending.metadataHash,
			tokenURI: pending.tokenURI,
			attributes: pending.attributes,
		};

		const movement = await executeTrainMovement({
			operation: "yoink",
			tokenId: nextTokenId,
			preparedNFT: preparedNFTData,
			contractService,
			newHolder: {
				fid: yoinkerData.fid,
				username: yoinkerData.username,
				displayName: yoinkerData.displayName,
				pfpUrl: yoinkerData.pfpUrl,
				address: targetAddress,
			},
			departingPassenger: {
				fid: departingPassengerData.currentHolder.fid,
				username: departingPassengerData.currentHolder.username,
				displayName: departingPassengerData.currentHolder.displayName,
				pfpUrl: departingPassengerData.currentHolder.pfpUrl,
				address: departingPassengerAddress,
			},
			totalEligibleReactors: 1,
			needsMetadataOnchain: true,
			metadataOperation: async (actualTokenId) => {
				await contractService.setTicketData(
					actualTokenId,
					preparedNFTData.tokenURI,
					`ipfs://${preparedNFTData.imageHash}`,
				);
			},
			contractOperation: async () => {
				const txHash = await contractService.executeYoink(
					targetAddress as `0x${string}`,
				);
				const mintedTokenId =
					(await contractService.getMintedTokenIdFromTx(txHash)) ?? nextTokenId;

				return {
					txHash,
					actualTokenId: mintedTokenId,
				};
			},
		});

		if (!movement.success) {
			orchestratorLog.error(toOrchestratorLogCode("yoink", "failed"), {
				userFid,
				error: movement.error,
			});
			return {
				status: 500,
				body: { success: false, error: movement.error ?? "Yoink failed" },
			} as const;
		}

		const timestamp = Date.now();
		try {
			// Welcome cast for yoinker
			const welcomeResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🚂 ChooChoo was yoinked by @${yoinkerData.username}!`,
					embeds: [{ url: APP_URL }],
					idem: `welcome-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!welcomeResponse.ok) {
				const errorData = await welcomeResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("yoink", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "welcome_cast",
						status: welcomeResponse.status,
						error: errorData.error,
					},
				);
			}

			// Ticket issued cast for departing passenger with image
			const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${pending.imageHash}`;
			const ticketResponse = await fetch(`${APP_URL}/api/internal/send-cast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-internal-secret": INTERNAL_SECRET,
				},
				body: JSON.stringify({
					text: `🎫 Ticket #${movement.tokenId} minted to @${departingPassengerData.currentHolder.username}!`,
					embeds: [{ url: imageUrl }],
					idem: `ticket-${movement.tokenId}-${timestamp}`,
				}),
			});
			if (!ticketResponse.ok) {
				const errorData = await ticketResponse.json();
				orchestratorLog.warn(
					toOrchestratorLogCode("yoink", "post_commit_warning"),
					{
						tokenId: movement.tokenId,
						stage: "ticket_cast",
						status: ticketResponse.status,
						error: errorData.error,
					},
				);
			}
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("yoink", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "cast_requests",
					error: err,
				},
			);
		}

		try {
			// Notify everyone about the yoink
			await sendChooChooNotification("yoinkAnnouncement", yoinkerData.username);

			// Notify departing passenger about their ticket NFT
			await sendChooChooNotification(
				"ticketMinted",
				departingPassengerData.currentHolder.username,
				movement.tokenId,
				departingPassengerData.currentHolder.fid,
			);

			// Notify yoinker that ChooChoo has arrived
			await sendChooChooNotification(
				"chooChooArrived",
				yoinkerData.username,
				yoinkerData.fid,
			);
		} catch (err) {
			orchestratorLog.warn(
				toOrchestratorLogCode("yoink", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "notifications",
					error: err,
				},
			);
		}

		try {
			await fetch(`${APP_URL}/api/workflow-state`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					state: "NOT_CASTED",
					winnerSelectionStart: null,
					currentCastHash: null,
				}),
			});
		} catch (workflowError) {
			orchestratorLog.warn(
				toOrchestratorLogCode("yoink", "post_commit_warning"),
				{
					tokenId: movement.tokenId,
					stage: "workflow_state",
					error: workflowError,
				},
			);
		}

		return {
			status: 200,
			body: {
				success: true,
				tokenId: movement.tokenId,
				txHash: movement.txHash,
				tokenURI: movement.tokenURI,
				yoinkedBy: yoinkerData.username,
			},
		} as const;
	} catch (error) {
		orchestratorLog.error(toOrchestratorLogCode("yoink", "failed"), {
			userFid,
			error,
		});
		return {
			status: 500,
			body: { success: false, error: (error as Error).message },
		} as const;
	} finally {
		await releaseLock(lockKey);
		await releaseLock(globalLockKey);
	}
}
