import { getContractService } from '@/lib/services/contract';
import {
  acquireLock,
  releaseLock,
  getOrSetPendingGeneration,
  storeTokenDataWriteOnce,
  storeLastMovedTimestamp,
  REDIS_KEYS,
} from '@/lib/redis-token-utils';
import { redis } from '@/lib/kv';
import type { TokenData } from '@/types/nft';
import { APP_URL } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

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
  context: string
): Promise<void> {
  try {
    const postNextId = await contractService.getNextOnChainTicketId();
    // The next ID should be at least one more than the minted token ID
    // This is more tolerant since we're using the authoritative minted ID
    if (postNextId <= mintedTokenId) {
      console.warn(
        `[${context}] Contract nextTicketId verification: expected > ${mintedTokenId}, got ${postNextId}`
      );
    } else {
      console.log(
        `[${context}] Contract nextTicketId verification passed: ${postNextId} > ${mintedTokenId}`
      );
    }
  } catch (err) {
    console.warn(`[${context}] Failed to verify post-mint contract state (non-critical):`, err);
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
  sourceType: 'send-train' | 'user-send-train' | 'admin-send-train' | 'yoink';
}

export interface TrainMovementResult {
  success: boolean;
  tokenId: number;
  txHash: string;
  tokenURI: string;
  error?: string;
}

/**
 * Unified train movement orchestrator that ensures consistent token ID handling
 * and prevents off-by-one errors by using on-chain data as the source of truth.
 *
 * This function:
 * 1. Gets the authoritative next token ID from the contract
 * 2. Generates NFT metadata with the correct departing passenger
 * 3. Executes the train movement and mints the ticket NFT
 * 4. Stores comprehensive token data in Redis
 * 5. Updates the current holder in Redis
 *
 * @param request - The train movement request data
 * @returns Promise<TrainMovementResult> - The result of the train movement
 */
export async function orchestrateTrainMovement(
  request: TrainMovementRequest
): Promise<TrainMovementResult> {
  const { newHolder, departingPassenger, sourceCastHash, totalEligibleReactors, sourceType } =
    request;

  try {
    // 1. Get the authoritative next token ID from the contract
    const contractService = getContractService();
    const tokenId = await contractService.getNextOnChainTicketId();
    console.log(`[train-orchestrator] Next token ID from contract: ${tokenId}`);

    // 2. Generate NFT metadata with the departing passenger's username
    let nftData;
    try {
      const generateResponse = await fetch(`${APP_URL}/api/internal/generate-nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          tokenId,
          passengerUsername: departingPassenger.username,
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(`NFT generation failed: ${errorData.error || 'Unknown error'}`);
      }

      nftData = await generateResponse.json();
      if (!nftData.success) {
        throw new Error(`NFT generation failed: ${nftData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[train-orchestrator] Failed to generate NFT:', err);
      return {
        success: false,
        tokenId: 0,
        txHash: '',
        tokenURI: '',
        error: `Failed to generate NFT: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }

    // 3. Execute train movement and mint ticket NFT
    let mintData;
    try {
      const mintResponse = await fetch(`${APP_URL}/api/internal/mint-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          newHolderAddress: newHolder.address,
          tokenURI: nftData.tokenURI,
          newHolderData: {
            username: newHolder.username,
            fid: newHolder.fid,
            displayName: newHolder.displayName,
            pfpUrl: newHolder.pfpUrl,
          },
          previousHolderData: {
            username: departingPassenger.username,
            fid: departingPassenger.fid,
            displayName: departingPassenger.displayName,
            pfpUrl: departingPassenger.pfpUrl,
          },
          sourceCastHash,
          totalEligibleReactors,
        }),
      });

      if (!mintResponse.ok) {
        const errorData = await mintResponse.json();
        throw new Error(`Token minting failed: ${errorData.error || 'Unknown error'}`);
      }

      mintData = await mintResponse.json();
      if (!mintData.success) {
        throw new Error(`Token minting failed: ${mintData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[train-orchestrator] Failed to mint token:', err);
      return {
        success: false,
        tokenId: 0,
        txHash: '',
        tokenURI: '',
        error: `Failed to mint token: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }

    console.log(
      `[train-orchestrator] Successfully orchestrated ${sourceType} movement for token ${mintData.actualTokenId}`
    );

    return {
      success: true,
      tokenId: mintData.actualTokenId,
      txHash: mintData.txHash,
      tokenURI: nftData.tokenURI,
    };
  } catch (error) {
    console.error('[train-orchestrator] Orchestration failed:', error);
    return {
      success: false,
      tokenId: 0,
      txHash: '',
      tokenURI: '',
      error: `Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Manual send orchestrator using prepare-then-commit pattern
 *
 * This function implements a two-phase approach:
 * 1. Preparation Phase: Fetch all data, validate, prepare structures (reversible)
 * 2. Commit Phase: Execute blockchain transaction (point of no return)
 * 3. Post-Commit Phase: Update app state with prepared data (should rarely fail)
 */
export async function orchestrateManualSend(currentHolderFid: number, targetFid: number) {
  const lockKey = `lock:manual:${currentHolderFid}:${targetFid}`;
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

  console.log(
    `[orchestrateManualSend] Starting manual send orchestration: FID ${currentHolderFid} -> ${targetFid}`
  );

  // Acquire distributed lock
  const locked = await acquireLock(lockKey, 30_000);
  if (!locked) {
    console.warn(
      `[orchestrateManualSend] Lock acquisition failed for ${currentHolderFid} -> ${targetFid}`
    );
    return {
      status: 409,
      body: { success: false, error: 'Manual send already in progress' },
    } as const;
  }

  try {
    // 2) Authoritative next token id
    const contractService = getContractService();
    const nextTokenId = await contractService.getNextOnChainTicketId();

    // Resolve departing passenger (current holder) + target from external sources
    const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
    if (!currentHolderRes.ok) throw new Error('Failed to fetch current holder');
    const departingPassengerData = await currentHolderRes.json();

    const winnerRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}`,
      {
        headers: { accept: 'application/json', 'x-api-key': process.env.NEYNAR_API_KEY || '' },
      }
    );
    if (!winnerRes.ok) throw new Error('Failed to fetch target user');
    const winnerJson = await winnerRes.json();
    const user = winnerJson?.users?.[0];
    if (!user) throw new Error('Target user not found');
    const targetAddress =
      user.verified_addresses?.primary?.eth_address || user.verified_addresses?.eth_addresses?.[0];
    if (!targetAddress) throw new Error('Target user missing address');

    // Get departing passenger address for NFT ticket holder
    let departingPassengerAddress = departingPassengerData.currentHolder?.address;
    if (!departingPassengerAddress) {
      // Fallback: fetch from Neynar if not in Redis current-holder
      const departingRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${currentHolderFid}`,
        {
          headers: { accept: 'application/json', 'x-api-key': process.env.NEYNAR_API_KEY || '' },
        }
      );
      if (departingRes.ok) {
        const departingJson = await departingRes.json();
        const departingUser = departingJson?.users?.[0];
        departingPassengerAddress =
          departingUser?.verified_addresses?.primary?.eth_address ||
          departingUser?.verified_addresses?.eth_addresses?.[0];
      }
    }
    if (!departingPassengerAddress) throw new Error('Departing passenger missing address');

    // 3) Pending generation cache
    const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
      const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          tokenId: nextTokenId,
          passengerUsername: departingPassengerData.currentHolder.username,
        }),
      });
      if (!genRes.ok) throw new Error('generate-nft failed');
      const gen = await genRes.json();
      return {
        imageHash: gen.imageHash,
        metadataHash: gen.metadataHash,
        tokenURI: gen.tokenURI,
        attributes: gen.metadata?.attributes || [],
        passengerUsername: departingPassengerData.currentHolder.username,
      };
    });

    // 4) Pure mint (no Redis writes - mint endpoint is now pure)
    const mintRes = await fetch(`${APP_URL}/api/internal/mint-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
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
    const mint = await mintRes.json();

    // Get the actual minted token ID from the transaction receipt
    let actualTokenId: number;
    const mintedTokenId = await contractService.getMintedTokenIdFromTx(
      mint.txHash as `0x${string}`
    );
    if (mintedTokenId !== null) {
      actualTokenId = mintedTokenId;
      console.log(
        `[train-orchestrator] Using authoritative token ID from transaction: ${actualTokenId}`
      );
    } else {
      actualTokenId = nextTokenId;
      console.warn(
        `[train-orchestrator] Failed to get token ID from transaction receipt, falling back to pre-mint nextTokenId: ${actualTokenId}`
      );
    }

    // Verify the contract state was updated correctly (now using authoritative token ID)
    await verifyNextIdAdvanced(contractService, actualTokenId, 'train-orchestrator');

    // 5) Store last moved timestamp
    try {
      await storeLastMovedTimestamp(actualTokenId, mint.txHash);
      console.log(`[train-orchestrator] Stored last moved timestamp for token ${actualTokenId}`);
    } catch (err) {
      console.error('[train-orchestrator] Failed to store last moved timestamp:', err);
    }

    // 6) Store token data write-once (NFT ticket holder is departing passenger)
    const tokenData: TokenData = {
      tokenId: actualTokenId,
      imageHash: pending.imageHash,
      metadataHash: pending.metadataHash,
      tokenURI: pending.tokenURI,
      holderAddress: departingPassengerAddress,
      holderUsername: departingPassengerData.currentHolder.username,
      holderFid: departingPassengerData.currentHolder.fid,
      holderDisplayName: departingPassengerData.currentHolder.displayName,
      holderPfpUrl: departingPassengerData.currentHolder.pfpUrl,
      transactionHash: mint.txHash,
      timestamp: new Date().toISOString(),
      attributes: pending.attributes,
      sourceType: 'manual',
      sourceCastHash: undefined,
      totalEligibleReactors: 1,
    };
    await storeTokenDataWriteOnce(tokenData);

    // 7) Update current holder in Redis for frontend access
    try {
      const currentHolderData = {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        address: targetAddress,
        timestamp: new Date().toISOString(),
      };
      await redis.set('current-holder', JSON.stringify(currentHolderData));
      try {
        const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
        await redisPub.publish(CURRENT_HOLDER_CHANNEL, JSON.stringify({ type: 'holder-updated' }));
      } catch {}
      console.log(
        `[train-orchestrator] Updated current holder to: ${user.username} (FID: ${user.fid})`
      );
    } catch (err) {
      console.error('[train-orchestrator] Failed to store current holder in Redis:', err);
    }

    // Optional: cleanup pending NFT cache after successful commit
    try {
      await redis.del(REDIS_KEYS.pendingNFT(actualTokenId));
    } catch {}

    // 8) Announcement casts with idempotency key
    try {
      // Welcome cast for new holder
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🚂 ChooChoo is heading to @${user.username}!`,
          idem: `welcome-${actualTokenId}`,
        }),
      });

      // Ticket issued cast for departing passenger
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🎫 Ticket #${actualTokenId} minted to @${departingPassengerData.currentHolder.username}!`,
          idem: `ticket-${actualTokenId}`,
        }),
      });
    } catch {}

    // 9) Workflow state: set NOT_CASTED for new holder
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'NOT_CASTED',
          winnerSelectionStart: null,
          currentCastHash: null,
        }),
      });
    } catch {}

    return {
      status: 200,
      body: {
        success: true,
        tokenId: actualTokenId,
        txHash: mint.txHash,
        tokenURI: pending.tokenURI,
      },
    } as const;
  } catch (error) {
    // 10) On failure: reset state to CASTED
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'CASTED' }),
      });
    } catch {}
    return { status: 500, body: { success: false, error: (error as Error).message } } as const;
  } finally {
    // 11) Release lock
    await releaseLock(lockKey);
  }
}

/**
 * Random winner orchestrator with single-writer semantics and idempotency.
 * Used for public chance mode - selects random winner from cast reactions.
 */
export async function orchestrateRandomSend(castHash: string) {
  const contractService = getContractService();
  const lockKey = `lock:random:${castHash}`;
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

  // 1) Acquire short-lived lock
  const locked = await acquireLock(lockKey, 30_000);
  if (!locked) {
    return {
      status: 409,
      body: { success: false, error: 'Random send already in progress' },
    } as const;
  }

  try {
    // 2) Authoritative next token id
    const nextTokenId = await contractService.getNextOnChainTicketId();

    // 3) Select random winner from cast reactions
    const winnerRes = await fetch(`${APP_URL}/api/internal/select-winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify({ castHash }),
    });
    if (!winnerRes.ok) throw new Error('Winner selection failed');
    const winnerData = await winnerRes.json();
    if (!winnerData.success) throw new Error(winnerData.error || 'Winner selection failed');

    // 4) Resolve departing passenger (current holder)
    const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
    if (!currentHolderRes.ok) throw new Error('Failed to fetch current holder');
    const departingPassengerData = await currentHolderRes.json();
    if (!departingPassengerData.hasCurrentHolder) throw new Error('No current holder found');

    // Get departing passenger address for NFT ticket holder
    let departingPassengerAddress = departingPassengerData.currentHolder?.address;
    if (!departingPassengerAddress) {
      // Fallback: fetch from Neynar if not in Redis current-holder
      const departingRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${departingPassengerData.currentHolder.fid}`,
        {
          headers: { accept: 'application/json', 'x-api-key': process.env.NEYNAR_API_KEY || '' },
        }
      );
      if (departingRes.ok) {
        const departingJson = await departingRes.json();
        const departingUser = departingJson?.users?.[0];
        departingPassengerAddress =
          departingUser?.verified_addresses?.primary?.eth_address ||
          departingUser?.verified_addresses?.eth_addresses?.[0];
      }
    }
    if (!departingPassengerAddress) throw new Error('Departing passenger missing address');

    // 5) Pending generation cache
    const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
      const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          tokenId: nextTokenId,
          passengerUsername: departingPassengerData.currentHolder.username,
        }),
      });
      if (!genRes.ok) throw new Error('generate-nft failed');
      const gen = await genRes.json();
      return {
        imageHash: gen.imageHash,
        metadataHash: gen.metadataHash,
        tokenURI: gen.tokenURI,
        attributes: gen.metadata?.attributes || [],
        passengerUsername: departingPassengerData.currentHolder.username,
      };
    });

    // 6) Pure mint (no Redis writes - mint endpoint is now pure)
    const mintRes = await fetch(`${APP_URL}/api/internal/mint-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
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
      }),
    });
    if (!mintRes.ok) {
      const errText = await mintRes.text();
      throw new Error(`mint-token failed: ${errText}`);
    }
    const mint = await mintRes.json();

    // Get the actual minted token ID from the transaction receipt
    let actualTokenId: number;
    const mintedTokenId = await contractService.getMintedTokenIdFromTx(
      mint.txHash as `0x${string}`
    );
    if (mintedTokenId !== null) {
      actualTokenId = mintedTokenId;
      console.log(
        `[train-orchestrator] Using authoritative token ID from transaction: ${actualTokenId}`
      );
    } else {
      actualTokenId = nextTokenId;
      console.warn(
        `[train-orchestrator] Failed to get token ID from transaction receipt, falling back to pre-mint nextTokenId: ${actualTokenId}`
      );
    }

    // Verify the contract state was updated correctly (now using authoritative token ID)
    await verifyNextIdAdvanced(contractService, actualTokenId, 'train-orchestrator');

    // 7) Store last moved timestamp
    try {
      await storeLastMovedTimestamp(actualTokenId, mint.txHash);
      console.log(`[train-orchestrator] Stored last moved timestamp for token ${actualTokenId}`);
    } catch (err) {
      console.error('[train-orchestrator] Failed to store last moved timestamp:', err);
    }

    // 8) Store token data write-once (NFT ticket holder is departing passenger)
    const tokenData: TokenData = {
      tokenId: actualTokenId,
      imageHash: pending.imageHash,
      metadataHash: pending.metadataHash,
      tokenURI: pending.tokenURI,
      holderAddress: departingPassengerAddress,
      holderUsername: departingPassengerData.currentHolder.username,
      holderFid: departingPassengerData.currentHolder.fid,
      holderDisplayName: departingPassengerData.currentHolder.displayName,
      holderPfpUrl: departingPassengerData.currentHolder.pfpUrl,
      transactionHash: mint.txHash,
      timestamp: new Date().toISOString(),
      attributes: pending.attributes,
      sourceType: 'send-train',
      sourceCastHash: castHash,
      totalEligibleReactors: winnerData.totalEligibleReactors,
    };
    await storeTokenDataWriteOnce(tokenData);

    // 9) Update current holder in Redis for frontend access
    try {
      const currentHolderData = {
        fid: winnerData.winner.fid,
        username: winnerData.winner.username,
        displayName: winnerData.winner.displayName,
        pfpUrl: winnerData.winner.pfpUrl,
        address: winnerData.winner.address,
        timestamp: new Date().toISOString(),
      };
      await redis.set('current-holder', JSON.stringify(currentHolderData));
      try {
        const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
        await redisPub.publish(CURRENT_HOLDER_CHANNEL, JSON.stringify({ type: 'holder-updated' }));
      } catch {}
      console.log(
        `[train-orchestrator] Updated current holder to: ${winnerData.winner.username} (FID: ${winnerData.winner.fid})`
      );
    } catch (err) {
      console.error('[train-orchestrator] Failed to store current holder in Redis:', err);
    }

    // Optional: cleanup pending NFT cache after successful commit
    try {
      await redis.del(REDIS_KEYS.pendingNFT(actualTokenId));
    } catch {}

    // 10) Announcement casts with idempotency key
    try {
      // Welcome cast for new holder
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🚂 ChooChoo is heading to @${winnerData.winner.username}!`,
          embeds: [{ url: APP_URL }],
          idem: `welcome-${actualTokenId}`,
        }),
      });

      // Ticket issued cast for departing passenger with image
      const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${pending.imageHash}`;
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🎫 Ticket #${actualTokenId} minted to @${departingPassengerData.currentHolder.username}!`,
          embeds: [{ url: imageUrl }],
          idem: `ticket-${actualTokenId}`,
        }),
      });
    } catch {}

    // 11) Workflow state: set NOT_CASTED for new holder
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'NOT_CASTED',
          winnerSelectionStart: null,
          currentCastHash: null,
        }),
      });
    } catch {}

    return {
      status: 200,
      body: {
        success: true,
        tokenId: actualTokenId,
        txHash: mint.txHash,
        tokenURI: pending.tokenURI,
        winner: winnerData.winner,
        totalEligibleReactors: winnerData.totalEligibleReactors,
      },
    } as const;
  } catch (error) {
    // 12) On failure: reset state to CASTED
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'CASTED' }),
      });
    } catch {}
    return { status: 500, body: { success: false, error: (error as Error).message } } as const;
  } finally {
    // 13) Release lock
    await releaseLock(lockKey);
  }
}

/**
 * Yoink orchestrator with single-writer semantics and idempotency.
 * Used for yoink operations - allows users to yoink the train if conditions are met.
 */
export async function orchestrateYoink(userFid: number, targetAddress: string) {
  const contractService = getContractService();
  const lockKey = `lock:yoink:${userFid}:${targetAddress}`;
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

  // 1) Acquire short-lived lock
  const locked = await acquireLock(lockKey, 30_000);
  if (!locked) {
    return { status: 409, body: { success: false, error: 'Yoink already in progress' } } as const;
  }

  try {
    // 2) Check eligibility: isYoinkable(), hasBeenPassenger(), deposit
    const yoinkStatus = await contractService.isYoinkable();
    if (!yoinkStatus.canYoink) {
      throw new Error(`Yoink not available: ${yoinkStatus.reason}`);
    }

    const hasRidden = await contractService.hasBeenPassenger(targetAddress as `0x${string}`);
    if (hasRidden) {
      throw new Error('Target address has already ridden the train');
    }

    const hasDeposited = await contractService.hasDepositedEnough(userFid);
    if (!hasDeposited) {
      throw new Error('Insufficient USDC deposit. You must deposit at least 1 USDC to yoink.');
    }

    // 3) Authoritative next token id
    const nextTokenId = await contractService.getNextOnChainTicketId();

    // 4) Resolve departing passenger (current holder) + yoinker data
    const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
    if (!currentHolderRes.ok) throw new Error('Failed to fetch current holder');
    const departingPassengerData = await currentHolderRes.json();
    if (!departingPassengerData.hasCurrentHolder) throw new Error('No current holder found');

    const yoinkerRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${userFid}`,
      {
        headers: { accept: 'application/json', 'x-api-key': process.env.NEYNAR_API_KEY || '' },
      }
    );
    if (!yoinkerRes.ok) throw new Error('Failed to fetch yoinker user data');
    const yoinkerJson = await yoinkerRes.json();
    const yoinkerUser = yoinkerJson?.users?.[0];
    if (!yoinkerUser) throw new Error('Yoinker user not found');

    const yoinkerData = {
      fid: yoinkerUser.fid,
      username: yoinkerUser.username,
      display_name: yoinkerUser.display_name,
      pfp_url: yoinkerUser.pfp_url,
    };

    // Get departing passenger address for NFT ticket holder
    let departingPassengerAddress = departingPassengerData.currentHolder?.address;
    if (!departingPassengerAddress) {
      // Fallback: fetch from Neynar if not in Redis current-holder
      const departingRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${departingPassengerData.currentHolder.fid}`,
        {
          headers: { accept: 'application/json', 'x-api-key': process.env.NEYNAR_API_KEY || '' },
        }
      );
      if (departingRes.ok) {
        const departingJson = await departingRes.json();
        const departingUser = departingJson?.users?.[0];
        departingPassengerAddress =
          departingUser?.verified_addresses?.primary?.eth_address ||
          departingUser?.verified_addresses?.eth_addresses?.[0];
      }
    }
    if (!departingPassengerAddress) throw new Error('Departing passenger missing address');

    // 5) Pending generation cache
    const pending = await getOrSetPendingGeneration(nextTokenId, async () => {
      const genRes = await fetch(`${APP_URL}/api/internal/generate-nft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          tokenId: nextTokenId,
          passengerUsername: departingPassengerData.currentHolder.username,
        }),
      });
      if (!genRes.ok) throw new Error('generate-nft failed');
      const gen = await genRes.json();
      return {
        imageHash: gen.imageHash,
        metadataHash: gen.metadataHash,
        tokenURI: gen.tokenURI,
        attributes: gen.metadata?.attributes || [],
        passengerUsername: departingPassengerData.currentHolder.username,
      };
    });

    // 6) Acquire mint lock to prevent double yoink for same tokenId
    const mintLockKey = `lock:mint:${nextTokenId}`;
    const mintLocked = await acquireLock(mintLockKey, 30_000);
    if (!mintLocked) {
      throw new Error('Mint in progress for this token ID');
    }

    let txHash: string;
    try {
      console.log(`[orchestrateYoink] Executing yoink to address: ${targetAddress}`);
      txHash = await contractService.executeYoink(targetAddress as `0x${string}`);
      console.log(`[orchestrateYoink] Yoink transaction hash: ${txHash}`);
    } finally {
      await releaseLock(mintLockKey);
    }

    // Get the actual minted token ID from the transaction receipt
    let actualTokenId: number;
    const mintedTokenId = await contractService.getMintedTokenIdFromTx(txHash as `0x${string}`);
    if (mintedTokenId !== null) {
      actualTokenId = mintedTokenId;
      console.log(
        `[orchestrateYoink] Using authoritative token ID from transaction: ${actualTokenId}`
      );
    } else {
      actualTokenId = nextTokenId;
      console.warn(
        `[orchestrateYoink] Failed to get token ID from transaction receipt, falling back to pre-mint nextTokenId: ${actualTokenId}`
      );
    }

    // Verify the contract state was updated correctly (optional validation, now tolerant)
    await verifyNextIdAdvanced(contractService, actualTokenId, 'orchestrateYoink');

    // 6.5) Set ticket metadata on-chain
    try {
      console.log(`[orchestrateYoink] Setting ticket metadata for token ${actualTokenId}`);
      await contractService.setTicketData(
        actualTokenId,
        pending.tokenURI,
        `ipfs://${pending.imageHash}`
      );
      console.log(`[orchestrateYoink] Ticket metadata set for token ${actualTokenId}`);
    } catch (err) {
      console.error(
        `[orchestrateYoink] Failed to set ticket metadata for token ${actualTokenId}:`,
        err
      );
      // Don't throw - the yoink succeeded, metadata setting is secondary
    }

    // 7) Store last moved timestamp
    try {
      await storeLastMovedTimestamp(actualTokenId, txHash);
      console.log(`[orchestrateYoink] Stored last moved timestamp for token ${actualTokenId}`);
    } catch (err) {
      console.error('[orchestrateYoink] Failed to store last moved timestamp:', err);
    }

    // 8) Store token data write-once (NFT ticket holder is departing passenger)
    const tokenData: TokenData = {
      tokenId: actualTokenId,
      imageHash: pending.imageHash,
      metadataHash: pending.metadataHash,
      tokenURI: pending.tokenURI,
      holderAddress: departingPassengerAddress,
      holderUsername: departingPassengerData.currentHolder.username,
      holderFid: departingPassengerData.currentHolder.fid,
      holderDisplayName: departingPassengerData.currentHolder.displayName,
      holderPfpUrl: departingPassengerData.currentHolder.pfpUrl,
      transactionHash: txHash,
      timestamp: new Date().toISOString(),
      attributes: pending.attributes,
      sourceType: 'yoink',
      sourceCastHash: undefined,
      totalEligibleReactors: 1,
    };
    await storeTokenDataWriteOnce(tokenData);

    // 9) Update current holder = yoinker (address = targetAddress)
    try {
      const currentHolderData = {
        fid: yoinkerData.fid,
        username: yoinkerData.username,
        displayName: yoinkerData.display_name,
        pfpUrl: yoinkerData.pfp_url,
        address: targetAddress,
        timestamp: new Date().toISOString(),
      };
      await redis.set('current-holder', JSON.stringify(currentHolderData));
      try {
        const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
        await redisPub.publish(CURRENT_HOLDER_CHANNEL, JSON.stringify({ type: 'holder-updated' }));
      } catch {}
      console.log(
        `[orchestrateYoink] Updated current holder to: ${yoinkerData.username} (FID: ${yoinkerData.fid})`
      );
    } catch (err) {
      console.error('[orchestrateYoink] Failed to store current holder in Redis:', err);
    }

    // Optional: cleanup pending NFT cache after successful commit
    try {
      await redis.del(REDIS_KEYS.pendingNFT(actualTokenId));
    } catch {}

    // 10) Send two idempotent casts
    try {
      // Welcome cast for yoinker
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🚂 ChooChoo was yoinked by @${yoinkerData.username}!`,
          embeds: [{ url: APP_URL }],
          idem: `welcome-${actualTokenId}`,
        }),
      });

      // Ticket issued cast for departing passenger with image
      const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${pending.imageHash}`;
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({
          text: `🎫 Ticket #${actualTokenId} minted to @${departingPassengerData.currentHolder.username}!`,
          embeds: [{ url: imageUrl }],
          idem: `ticket-${actualTokenId}`,
        }),
      });
    } catch {}

    // 11) Set workflow to NOT_CASTED
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'NOT_CASTED',
          winnerSelectionStart: null,
          currentCastHash: null,
        }),
      });
    } catch {}

    return {
      status: 200,
      body: {
        success: true,
        tokenId: actualTokenId,
        txHash,
        tokenURI: pending.tokenURI,
        yoinkedBy: yoinkerData.username,
      },
    } as const;
  } catch (error) {
    // 12) On failure: set state to CASTED
    try {
      await fetch(`${APP_URL}/api/workflow-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'CASTED' }),
      });
    } catch {}
    return { status: 500, body: { success: false, error: (error as Error).message } } as const;
  } finally {
    // 13) Release lock
    await releaseLock(lockKey);
  }
}
