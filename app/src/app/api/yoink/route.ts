import { NextRequest, NextResponse } from 'next/server';
import { getContractService } from '@/lib/services/contract';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * POST /api/yoink
 *
 * Orchestrates the yoink process for the ChooChoo train. Allows the caller to yoink the train
 * to their own wallet if the 48-hour cooldown has passed and they haven't ridden before.
 * Uses admin private key to execute the yoink on behalf of the user.
 *
 * @param request - The HTTP request object with body containing { targetAddress }
 * @returns 200 with { success: true, txHash, tokenId, tokenURI, yoinkedBy } on success, or 400/500 with error message.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[yoink] 🫡 Yoink request received');

    // 1. Parse request body
    let targetAddress: string;
    let userFid: number;
    try {
      const body = await request.json();
      targetAddress = body.targetAddress;
      userFid = body.userFid;

      if (!targetAddress) {
        return NextResponse.json(
          { error: 'targetAddress is required in request body' },
          { status: 400 }
        );
      }

      if (!userFid) {
        return NextResponse.json({ error: 'userFid is required in request body' }, { status: 400 });
      }

      if (!/^0x[a-fA-F0-9]{40}$/i.test(targetAddress)) {
        return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
      }
    } catch (err) {
      console.error('[yoink] Failed to parse request body:', err);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 2. Check yoink eligibility on contract
    let contractService;
    try {
      contractService = getContractService();
      const yoinkStatus = await contractService.isYoinkable();

      if (!yoinkStatus.canYoink) {
        console.error(`[yoink] Yoink not available: ${yoinkStatus.reason}`);
        return NextResponse.json(
          { error: `Yoink not available: ${yoinkStatus.reason}` },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[yoink] Failed to check yoink eligibility:', err);
      return NextResponse.json({ error: 'Failed to check yoink eligibility' }, { status: 500 });
    }

    // 3. Check if target address has already ridden the train
    try {
      const hasRidden = await contractService.hasRiddenTrain(targetAddress as `0x${string}`);
      if (hasRidden) {
        console.error(`[yoink] Target address ${targetAddress} has already ridden the train`);
        return NextResponse.json(
          { error: 'Target address has already ridden the train and cannot receive it again' },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[yoink] Failed to check if target has ridden train:', err);
      return NextResponse.json({ error: 'Failed to validate target address' }, { status: 500 });
    }

    // 4. Check USDC deposit requirement for yoinker
    try {
      const hasDeposited = await contractService.hasDepositedEnough(userFid);

      if (!hasDeposited) {
        const [deposited, required] = await Promise.all([
          contractService.getFidDeposited(userFid),
          contractService.getDepositCost(),
        ]);

        return NextResponse.json(
          {
            error:
              'Insufficient USDC deposit. You must deposit at least 1 USDC to yoink the train.',
            depositStatus: {
              required: required.toString(),
              deposited: deposited.toString(),
              satisfied: false,
            },
          },
          { status: 402 } // Payment Required
        );
      }
    } catch (err) {
      console.error('[yoink] Failed to check deposit status:', err);
      return NextResponse.json({ error: 'Failed to verify deposit status' }, { status: 500 });
    }

    // 5. Get current holder data before yoink (they will receive the ticket NFT)
    let currentHolderData = null;
    let nftRecipientAddress = null;
    try {
      const currentHolderResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/current-holder`
      );
      if (currentHolderResponse.ok) {
        const data = await currentHolderResponse.json();
        if (data.hasCurrentHolder) {
          currentHolderData = {
            username: data.currentHolder.username,
            fid: data.currentHolder.fid,
            displayName: data.currentHolder.displayName,
            pfpUrl: data.currentHolder.pfpUrl,
          };
          nftRecipientAddress = data.currentHolder.address;
          console.log(
            `[yoink] Current holder: ${currentHolderData.username} (FID: ${currentHolderData.fid}) will receive NFT`
          );
        }
      }
    } catch (err) {
      console.warn('[yoink] Failed to get current holder (non-critical):', err);
    }

    // 6. Get user data for the yoinker
    let yoinkerData = null;
    try {
      const userResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/user?fid=${userFid}`
      );
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user) {
          yoinkerData = {
            username: userData.user.username,
            fid: userData.user.fid,
            displayName: userData.user.displayName,
            pfpUrl: userData.user.pfpUrl,
            address: targetAddress,
          };
          console.log(`[yoink] Yoinker: ${yoinkerData.username} (FID: ${yoinkerData.fid})`);
        }
      }
    } catch (err) {
      console.warn('[yoink] Failed to get yoinker data (non-critical):', err);
    }

    // 6. Get next token ID for the ticket that will be minted
    let tokenId;
    try {
      tokenId = await contractService.getNextOnChainTicketId();
      console.log(`[yoink] Next token ID from contract: ${tokenId}`);
    } catch (err) {
      console.error('[yoink] Failed to get next token ID from contract:', err);
      return NextResponse.json({ error: 'Failed to get next token ID from contract' }, { status: 500 });
    }

    // 8. Generate NFT for the previous holder
    let nftData = null;
    if (currentHolderData?.username) {
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
              passengerUsername: currentHolderData.username,
            }),
          }
        );

        if (generateResponse.ok) {
          const result = await generateResponse.json();
          if (result.success) {
            nftData = result;
            console.log('[yoink] Generated NFT for current holder');
          }
        }
      } catch (err) {
        console.warn('[yoink] Failed to generate NFT (non-critical):', err);
      }
    }

    // 9. Execute yoink on contract
    let txHash;
    try {
      console.log(`[yoink] Executing yoink to address: ${targetAddress}`);
      txHash = await contractService.executeYoink(targetAddress as `0x${string}`);
      console.log(`[yoink] Yoink transaction hash: ${txHash}`);
    } catch (err) {
      console.error('[yoink] Failed to execute yoink on contract:', err);
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : 'Failed to execute yoink on contract',
        },
        { status: 500 }
      );
    }

    // 9. Update Redis with new holder data
    try {
      if (yoinkerData) {
        await redis.set('current-holder', JSON.stringify(yoinkerData));
        try {
          const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
          await redisPub.publish(
            CURRENT_HOLDER_CHANNEL,
            JSON.stringify({ type: 'holder-updated' })
          );
        } catch {}
        console.log(`[yoink] Updated current holder in Redis to: ${yoinkerData.username}`);
      }

      const workflowData = {
        state: 'NOT_CASTED',
        winnerSelectionStart: null,
        currentCastHash: null,
      };

      await redis.set('workflowState', JSON.stringify(workflowData));
      console.log('[yoink] Reset workflow state to NOT_CASTED after yoink');
    } catch (err) {
      console.warn('[yoink] Failed to update Redis (non-critical):', err);
    }

    // 10. Store comprehensive token data in Redis and set ticket data on contract
    if (nftData?.tokenURI && currentHolderData) {
      try {
        // Store token data in Redis using the same pattern as other endpoints
        const { storeTokenData } = await import('@/lib/redis-token-utils');
        const { createChooChooMetadata } = await import('@/lib/nft-metadata-utils');
        
        const metadataHash = nftData.metadataHash;
        const imageHash = nftData.imageHash;
        
        // Create proper metadata with Passenger trait using departing passenger's username
        const metadata = createChooChooMetadata(
          tokenId,
          imageHash,
          nftData.metadata?.attributes || [],
          currentHolderData.username
        );

        let actualTokenId = tokenId;
        try {
          const postNextId = await contractService.getNextOnChainTicketId();
          actualTokenId = postNextId - 1;
        } catch {}

        const tokenData = {
          tokenId: actualTokenId,
          imageHash,
          metadataHash,
          tokenURI: nftData.tokenURI,
          holderAddress: nftRecipientAddress || 'unknown', // NFT goes to departing passenger
          holderUsername: currentHolderData.username,
          holderFid: currentHolderData.fid,
          holderDisplayName: currentHolderData.displayName,
          holderPfpUrl: currentHolderData.pfpUrl,
          transactionHash: txHash,
          timestamp: new Date().toISOString(),
          attributes: metadata.attributes || [],
          sourceType: 'yoink' as const,
          sourceCastHash: undefined,
          totalEligibleReactors: 1,
        };

        await storeTokenData(tokenData);
        console.log(`[yoink] Stored comprehensive token data in Redis for token ${actualTokenId}`);
      } catch (err) {
        console.error('[yoink] Failed to store token data in Redis:', err);
      }

      try {
        // Set ticket data on contract
        // Use actual token ID for contract metadata
        const setDataResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/set-ticket-data`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              tokenId: (await (async () => {
                try {
                  const postNextId = await contractService.getNextOnChainTicketId();
                  return postNextId - 1;
                } catch {
                  return tokenId;
                }
              })()),
              tokenURI: nftData.tokenURI,
              image: nftData.imageHash ? `ipfs://${nftData.imageHash}` : '',
              traits: '',
            }),
          }
        );

        if (setDataResponse.ok) {
          console.log(`[yoink] Set ticket data using actual minted token ID`);
        } else {
          console.warn('[yoink] Failed to set ticket data (non-critical)');
        }
      } catch (err) {
        console.warn('[yoink] Failed to set ticket data (non-critical):', err);
      }
    }

    // 11. Send announcement casts
    try {
      if (yoinkerData?.username) {
        const yoinkCastText = CHOOCHOO_CAST_TEMPLATES.YOINK_ANNOUNCEMENT(yoinkerData.username);

        const yoinkCastResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              text: yoinkCastText,
              // channel_id: 'base', // @note: if we want to add a channel to the cast
            }),
          }
        );

        if (yoinkCastResponse.ok) {
          const castData = await yoinkCastResponse.json();
          console.log(`[yoink] Successfully sent yoink cast: ${castData.cast?.hash}`);
        } else {
          console.warn('[yoink] Failed to send yoink cast (non-critical)');
        }

        if (currentHolderData?.username && nftData?.imageHash) {
          // Announce using actual minted ID
          let announceTokenId = tokenId;
          try {
            const postNextId = await contractService.getNextOnChainTicketId();
            announceTokenId = postNextId - 1;
          } catch {}
          const ticketCastText = CHOOCHOO_CAST_TEMPLATES.TICKET_ISSUED(currentHolderData.username, announceTokenId);

          const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${nftData.imageHash}`;

          const ticketCastResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': INTERNAL_SECRET || '',
              },
              body: JSON.stringify({
                text: ticketCastText,
                embeds: [{ url: imageUrl }],
                // channel_id: 'base', // @note: if we want to add a channel to the cast
              }),
            }
          );

          if (ticketCastResponse.ok) {
            const ticketCastData = await ticketCastResponse.json();
            console.log(`[yoink] Successfully sent ticket cast: ${ticketCastData.cast?.hash}`);
          } else {
            console.warn('[yoink] Failed to send ticket cast (non-critical)');
          }
        }
      }
    } catch (err) {
      console.warn('[yoink] Failed to send announcement casts (non-critical):', err);
    }

    // 13. Return success response
    console.log(`[yoink] Successfully executed yoink for token to ${targetAddress}`);

    return NextResponse.json({
      success: true,
      txHash,
      tokenId: nftData ? tokenId : null,
      tokenURI: nftData?.tokenURI || null,
      yoinkedBy: yoinkerData?.username || 'unknown',
      previousHolder: currentHolderData?.username || 'unknown',
    });
  } catch (error) {
    console.error('[yoink] Yoink orchestration failed:', error);
    return NextResponse.json({ error: 'Failed to process yoink operation' }, { status: 500 });
  }
}
