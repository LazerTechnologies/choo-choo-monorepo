import { getContractService } from '@/lib/services/contract';
import type { Address } from 'viem';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

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
  const { newHolder, departingPassenger, sourceCastHash, totalEligibleReactors, sourceType } = request;

  try {
    // 1. Get the authoritative next token ID from the contract
    const contractService = getContractService();
    const tokenId = await contractService.getNextOnChainTicketId();
    console.log(`[train-orchestrator] Next token ID from contract: ${tokenId}`);

    // 2. Generate NFT metadata with the departing passenger's username
    let nftData;
    try {
      const generateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/generate-nft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tokenId,
            passengerUsername: departingPassenger.username,
          }),
        }
      );

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
      const mintResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/mint-token`,
        {
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
        }
      );

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
 * Specialized orchestrator for yoink operations that handles the unique yoink flow
 * 
 * @param targetAddress - The address to yoink the train to
 * @param userFid - The FID of the user performing the yoink
 * @param departingPassenger - The current holder who will receive the ticket NFT
 * @param yoinkerData - The data of the person yoinking the train
 * @returns Promise<TrainMovementResult> - The result of the yoink operation
 */
export async function orchestrateYoink(
  targetAddress: Address,
  userFid: number,
  departingPassenger: PassengerData,
  yoinkerData: PassengerData
): Promise<TrainMovementResult> {
  try {
    // 1. Get the authoritative next token ID from the contract
    const contractService = getContractService();
    const tokenId = await contractService.getNextOnChainTicketId();
    console.log(`[train-orchestrator] Next token ID for yoink: ${tokenId}`);

    // 2. Generate NFT metadata with the departing passenger's username
    let nftData = null;
    if (departingPassenger.username) {
      try {
        const generateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/generate-nft`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              tokenId,
              passengerUsername: departingPassenger.username,
            }),
          }
        );

        if (generateResponse.ok) {
          const result = await generateResponse.json();
          if (result.success) {
            nftData = result;
            console.log('[train-orchestrator] Generated NFT for departing passenger');
          }
        }
      } catch (err) {
        console.warn('[train-orchestrator] Failed to generate NFT for yoink (non-critical):', err);
      }
    }

    // 3. Execute yoink on contract
    const txHash = await contractService.executeYoink(targetAddress);
    console.log(`[train-orchestrator] Yoink transaction hash: ${txHash}`);

    // 4. Store token data and set ticket metadata if we have NFT data
    if (nftData?.tokenURI) {
      try {
        // Store token data in Redis
        const { storeTokenData } = await import('@/lib/redis-token-utils');
        const { createChooChooMetadata } = await import('@/lib/nft-metadata-utils');
        
        const metadata = createChooChooMetadata(
          tokenId,
          nftData.imageHash,
          nftData.metadata?.attributes || [],
          departingPassenger.username
        );

        const tokenData = {
          tokenId,
          imageHash: nftData.imageHash,
          metadataHash: nftData.metadataHash,
          tokenURI: nftData.tokenURI,
          holderAddress: departingPassenger.address,
          holderUsername: departingPassenger.username,
          holderFid: departingPassenger.fid,
          holderDisplayName: departingPassenger.displayName,
          holderPfpUrl: departingPassenger.pfpUrl,
          transactionHash: txHash,
          timestamp: new Date().toISOString(),
          attributes: metadata.attributes || [],
          sourceType: 'yoink' as const,
          sourceCastHash: undefined,
          totalEligibleReactors: 1,
        };

        await storeTokenData(tokenData);
        console.log(`[train-orchestrator] Stored token data for yoink token ${tokenId}`);

        // Set ticket data on contract
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/set-ticket-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tokenId,
            tokenURI: nftData.tokenURI,
            image: nftData.imageHash ? `ipfs://${nftData.imageHash}` : '',
            traits: '',
          }),
        });
      } catch (err) {
        console.error('[train-orchestrator] Failed to store yoink token data:', err);
      }
    }

    // 5. Update current holder in Redis
    try {
      const { redis } = await import('@/lib/kv');
      await redis.set('current-holder', JSON.stringify({
        fid: yoinkerData.fid,
        username: yoinkerData.username,
        displayName: yoinkerData.displayName,
        pfpUrl: yoinkerData.pfpUrl,
        address: yoinkerData.address,
        timestamp: new Date().toISOString(),
      }));

      try {
        const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
        await redisPub.publish(
          CURRENT_HOLDER_CHANNEL,
          JSON.stringify({ type: 'holder-updated' })
        );
      } catch {}

      console.log(`[train-orchestrator] Updated current holder to: ${yoinkerData.username}`);
    } catch (err) {
      console.warn('[train-orchestrator] Failed to update current holder (non-critical):', err);
    }

    return {
      success: true,
      tokenId,
      txHash,
      tokenURI: nftData?.tokenURI || '',
    };
  } catch (error) {
    console.error('[train-orchestrator] Yoink orchestration failed:', error);
    return {
      success: false,
      tokenId: 0,
      txHash: '',
      tokenURI: '',
      error: `Yoink failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
