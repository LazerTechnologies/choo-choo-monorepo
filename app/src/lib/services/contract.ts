import '@/lib/sanitize-logging';

import {
  type Abi,
  type Address,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  getContract,
  http,
  NonceTooLowError,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'wagmi/chains';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';

// Type-safe ABI for ChooChoo Train contract
const ChooChooTrainAbi = ChooChooTrainAbiJson as Abi;

// Export the typed ABI for use in other parts of the application
export { ChooChooTrainAbi };

// @todo: utilize paymaster for contract execution
interface ContractConfig {
  address: Address;
  rpcUrl: string;
  adminPrivateKey?: `0x${string}`;
  useMainnet: boolean;
}

interface TrainStatus {
  holder: Address;
  totalStops: bigint;
  lastMoveTime: bigint;
  canBeYoinked: boolean;
  nextTicketId: bigint;
}

export class ContractService {
  private config: ContractConfig;
  private chain;
  private adminAccount: ReturnType<typeof privateKeyToAccount> | null = null;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;

  constructor(config: ContractConfig) {
    this.config = config;
    this.chain = config.useMainnet ? base : baseSepolia;
  }

  static fromEnv(): ContractService {
    const address = process.env.CHOOCHOO_TRAIN_ADDRESS as Address;
    const rpcUrl = process.env.RPC_URL as string;
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
    const useMainnet = process.env.USE_MAINNET === 'true';

    if (!address || !rpcUrl) {
      throw new Error('Missing required environment variables: CHOOCHOO_TRAIN_ADDRESS, RPC_URL');
    }

    return new ContractService({
      address,
      rpcUrl,
      adminPrivateKey,
      useMainnet,
    });
  }

  private getAdminAccount() {
    if (!this.config.adminPrivateKey) {
      throw new Error(
        'Missing ADMIN_PRIVATE_KEY for contract execution. Admin role required for this operation.',
      );
    }

    if (!this.adminAccount) {
      this.adminAccount = privateKeyToAccount(this.config.adminPrivateKey, {
        nonceManager,
      });
    }

    return this.adminAccount;
  }

  private getWalletClient() {
    if (!this.walletClient) {
      const account = this.getAdminAccount();
      this.walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.config.rpcUrl),
      });
    }

    return this.walletClient;
  }

  private resetNonceManager() {
    const account = this.adminAccount;
    if (account?.nonceManager) {
      account.nonceManager.reset({
        address: account.address,
        chainId: this.chain.id,
      });
    }
  }

  private isNonceTooLowError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    if (error instanceof NonceTooLowError) return true;

    const cause = (error as { cause?: unknown }).cause;
    if (!cause) return false;
    return this.isNonceTooLowError(cause);
  }

  private async executeWithNonceRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isNonceTooLowError(error)) {
        console.warn(
          '[ContractService] Nonce too low detected, resetting nonce manager and retrying.',
        );
        this.resetNonceManager();
        return await operation();
      }
      throw error;
    }
  }

  private createPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Create a typed contract instance for type-safe function calls
   */
  private createTypedContract() {
    const publicClient = this.createPublicClient();

    return getContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      client: publicClient,
    });
  }

  /**
   * Read the current total supply from the contract
   */
  async getTotalSupply(): Promise<number> {
    const contract = this.createTypedContract();
    const totalSupply = await contract.read.totalSupply();
    return Number(totalSupply);
  }

  /**
   * Get the current train holder address
   */
  async getCurrentTrainHolder(): Promise<Address> {
    const contract = this.createTypedContract();
    const holder = await contract.read.getCurrentTrainHolder();
    return holder as Address;
  }

  /**
   * Get comprehensive train status information
   */
  async getTrainStatus(): Promise<TrainStatus> {
    const contract = this.createTypedContract();
    const status = await contract.read.getTrainStatus();

    const [holder, totalStops, lastMoveTime, canBeYoinked, nextTicketId] = status as [
      Address,
      bigint,
      bigint,
      boolean,
      bigint,
    ];

    return {
      holder,
      totalStops,
      lastMoveTime,
      canBeYoinked,
      nextTicketId,
    };
  }

  /**
   * Check if an address has ridden the train before
   */
  async hasBeenPassenger(address: Address): Promise<boolean> {
    const contract = this.createTypedContract();
    const hasRidden = await contract.read.hasBeenPassenger([address]);
    return hasRidden as boolean;
  }

  /**
   * Get the total number of tickets minted (excluding train token)
   */
  async getTotalTickets(): Promise<number> {
    const contract = this.createTypedContract();
    const totalTickets = await contract.read.getTotalTickets();
    return Number(totalTickets);
  }

  /**
   * Get the next ticket ID that will be minted (authoritative source of truth)
   * This is the ONLY method that should be used to determine the next token ID
   */
  async getNextOnChainTicketId(): Promise<number> {
    const trainStatus = await this.getTrainStatus();
    return Number(trainStatus.nextTicketId);
  }

  /**
   * Get token URI for a specific token ID (public method for repair scripts)
   */
  async getTokenURI(tokenId: number): Promise<string> {
    const contract = this.createTypedContract();
    const tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
    return tokenURI as string;
  }

  /**
   * Get the train journey length (number of stops made)
   */
  async getTrainJourneyLength(): Promise<number> {
    const contract = this.createTypedContract();
    const journeyLength = await contract.read.getTotalTickets();
    return Number(journeyLength);
  }

  /**
   * Get list of admin addresses
   */
  async getAdmins(): Promise<Address[]> {
    const contract = this.createTypedContract();
    const admins = await contract.read.getAdmins();
    return admins as Address[];
  }

  /**
   * Check if the train can be yoinked (cooldown check based on contract timer)
   */
  async isYoinkable(): Promise<{ canYoink: boolean; reason: string }> {
    const contract = this.createTypedContract();
    const result = await contract.read.isYoinkable();
    const [canYoink, reason] = result as [boolean, string];
    return { canYoink, reason };
  }

  /**
   * Get the yoink timer duration in hours from the contract
   */
  async getYoinkTimerHours(): Promise<number> {
    const contract = this.createTypedContract();
    const timerHours = await contract.read.yoinkTimerHours();
    return Number(timerHours);
  }

  /**
   * Execute the yoink function on the contract (admin-only)
   * @todo: use coinbase paymaster to cover gas costs
   */
  async executeYoink(recipient: Address): Promise<`0x${string}`> {
    try {
      const walletClient = this.getWalletClient();
      const publicClient = this.createPublicClient();

      const contract = getContract({
        address: this.config.address,
        abi: ChooChooTrainAbi,
        client: walletClient,
      });

      const hash = await this.executeWithNonceRetry(() => contract.write.yoink([recipient]));

      console.log(`[ContractService] Yoink transaction hash returned: ${hash}`);

      // Verify transaction was actually broadcast to the network
      try {
        const tx = await publicClient.getTransaction({ hash });
        if (!tx) {
          throw new Error(
            `Yoink transaction ${hash} was not found on the network. The transaction may have failed to broadcast.`,
          );
        }
        console.log(
          `[ContractService] Yoink transaction ${hash} confirmed on network, waiting for mining...`,
        );
      } catch (txCheckError) {
        console.error(
          `[ContractService] Failed to verify yoink transaction ${hash} exists:`,
          txCheckError,
        );
        throw new Error(
          `Yoink transaction ${hash} does not exist on the blockchain. The RPC may have failed to broadcast. Check RPC connectivity and try again.`,
        );
      }

      // Wait for transaction to be mined and check status
      console.log(`[ContractService] Waiting for yoink transaction ${hash} to be mined...`);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000, // 60 seconds
      });

      // Check if transaction reverted
      if (receipt.status === 'reverted') {
        console.error(`[ContractService] Yoink transaction ${hash} reverted on-chain`);
        throw new Error(
          `Yoink transaction reverted on-chain. The contract may have rejected the operation due to validation failures.`,
        );
      }

      console.log(
        `[ContractService] Yoink transaction ${hash} confirmed with status: ${receipt.status}`,
      );
      return hash;
    } catch (error) {
      // Enhanced error handling for yoink-specific restrictions
      if (error instanceof Error) {
        if (
          error.message.includes('AccessControlUnauthorizedAccount') ||
          error.message.includes('Not an admin')
        ) {
          throw new Error(
            'Admin role required: The current private key does not have ADMIN_ROLE permissions on the contract',
          );
        }
        if (error.message.includes('AlreadyRodeTrain')) {
          throw new Error(
            `Recipient ${recipient} has already ridden the train and cannot receive it again`,
          );
        }
        if (error.message.includes('CannotSendToCurrentPassenger')) {
          throw new Error(`Cannot yoink train to current holder ${recipient}`);
        }
        if (error.message.includes('NotEligibleToYoink')) {
          throw new Error('Cooldown not met - yoink not available yet');
        }
      }
      throw error;
    }
  }

  /**
   * Set ticket metadata on the contract (admin-only)
   */
  async setTicketData(tokenId: number, tokenURI: string, image: string): Promise<`0x${string}`> {
    try {
      const walletClient = this.getWalletClient();

      const contract = getContract({
        address: this.config.address,
        abi: ChooChooTrainAbi,
        client: walletClient,
      });

      const hash = await this.executeWithNonceRetry(() =>
        contract.write.setTicketData([BigInt(tokenId), tokenURI, image]),
      );
      return hash;
    } catch (error) {
      // Enhanced error handling for setTicketData-specific restrictions
      if (error instanceof Error) {
        if (
          error.message.includes('AccessControlUnauthorizedAccount') ||
          error.message.includes('Not an admin')
        ) {
          throw new Error(
            'Admin role required: The current private key does not have ADMIN_ROLE permissions on the contract',
          );
        }
        if (error.message.includes('Cannot update train NFT')) {
          throw new Error('Cannot update metadata for train NFT (token ID 0)');
        }
        if (error.message.includes('Token does not exist')) {
          throw new Error(`Token ${tokenId} does not exist`);
        }
      }
      throw error;
    }
  }

  /**
   * Execute the nextStop function on the contract
   * This function moves the train and sets ticket metadata in one transaction
   * @todo: use coinbase paymaster to cover gas costs
   */
  async executeNextStop(recipient: Address, tokenURI: string): Promise<`0x${string}`> {
    try {
      const walletClient = this.getWalletClient();
      const publicClient = this.createPublicClient();
      const account = this.getAdminAccount();

      // Pre-flight: Estimate gas to catch issues before broadcasting
      try {
        console.log(`[ContractService] Estimating gas for nextStop to ${recipient}...`);
        const gasEstimate = await publicClient.estimateContractGas({
          address: this.config.address,
          abi: ChooChooTrainAbi,
          functionName: 'nextStop',
          args: [recipient, tokenURI],
          account,
        });
        console.log(`[ContractService] Gas estimate: ${gasEstimate.toString()} units`);
      } catch (gasError) {
        console.error(`[ContractService] Gas estimation failed for nextStop:`, gasError);
        // Try to extract useful error message from the gas estimation failure
        if (gasError instanceof Error) {
          if (gasError.message.includes('AlreadyRodeTrain')) {
            throw new Error(
              `Recipient ${recipient} has already ridden the train and cannot receive it again (caught during gas estimation)`,
            );
          }
          if (gasError.message.includes('CannotSendToCurrentPassenger')) {
            throw new Error(
              `Cannot send train to current holder ${recipient} (caught during gas estimation)`,
            );
          }
          throw new Error(
            `Transaction will likely fail: ${gasError.message}. Gas estimation failed, indicating the transaction would revert.`,
          );
        }
        throw gasError;
      }

      const contract = getContract({
        address: this.config.address,
        abi: ChooChooTrainAbi,
        client: walletClient,
      });

      const hash = await this.executeWithNonceRetry(() =>
        contract.write.nextStop([recipient, tokenURI]),
      );

      console.log(`[ContractService] Transaction hash returned: ${hash}`);

      // Verify transaction was actually broadcast to the network
      try {
        const tx = await publicClient.getTransaction({ hash });
        if (!tx) {
          throw new Error(
            `Transaction ${hash} was not found on the network. The transaction may have failed to broadcast or was rejected by the RPC. This could be due to gas issues, nonce problems, or network connectivity.`,
          );
        }
        console.log(
          `[ContractService] Transaction ${hash} confirmed on network, waiting for mining...`,
        );
      } catch (txCheckError) {
        console.error(
          `[ContractService] Failed to verify transaction ${hash} exists on network:`,
          txCheckError,
        );
        throw new Error(
          `Transaction ${hash} does not exist on the blockchain. The RPC may have returned a hash but failed to broadcast the transaction. Check RPC connectivity and try again.`,
        );
      }

      // Wait for transaction to be mined and check status
      console.log(`[ContractService] Waiting for transaction ${hash} to be mined...`);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000, // 60 seconds
      });

      // Check if transaction reverted
      if (receipt.status === 'reverted') {
        console.error(`[ContractService] Transaction ${hash} reverted on-chain`);
        throw new Error(
          `Transaction reverted on-chain. The contract may have rejected the operation due to validation failures (e.g., recipient already rode train, sending to current holder, etc.)`,
        );
      }

      console.log(`[ContractService] Transaction ${hash} confirmed with status: ${receipt.status}`);
      return hash;
    } catch (error) {
      // Enhanced error handling for admin-only restrictions
      if (error instanceof Error) {
        if (error.message.includes('AccessControlUnauthorizedAccount')) {
          throw new Error(
            'Admin role required: The current private key does not have ADMIN_ROLE permissions on the contract',
          );
        }
        if (error.message.includes('AlreadyRodeTrain')) {
          throw new Error(
            `Recipient ${recipient} has already ridden the train and cannot receive it again`,
          );
        }
        if (error.message.includes('CannotSendToCurrentPassenger')) {
          throw new Error(`Cannot send train to current holder ${recipient}`);
        }
      }
      throw error;
    }
  }

  /**
   * Estimate gas for the nextStop transaction
   */
  async estimateNextStopGas(recipient: Address, tokenURI: string): Promise<bigint> {
    if (!this.config.adminPrivateKey) {
      throw new Error('Missing ADMIN_PRIVATE_KEY for gas estimation');
    }

    const account = this.getAdminAccount();
    const publicClient = this.createPublicClient();

    const gasEstimate = await publicClient.estimateContractGas({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'nextStop',
      args: [recipient, tokenURI],
      account,
    });

    return gasEstimate;
  }

  /**
   * Set the main token URI for the train (tokenId 0)
   */
  async setMainTokenURI(tokenURI: string): Promise<string> {
    if (!this.config.adminPrivateKey) {
      throw new Error('Missing ADMIN_PRIVATE_KEY for setting main token URI');
    }

    try {
      const walletClient = this.getWalletClient();

      const contract = getContract({
        address: this.config.address,
        abi: ChooChooTrainAbi,
        client: walletClient,
      });

      const hash = await this.executeWithNonceRetry(() =>
        contract.write.setMainTokenURI([tokenURI]),
      );
      console.log(`[ContractService] setMainTokenURI transaction hash: ${hash}`);
      return hash;
    } catch (error) {
      // Enhanced error handling for setMainTokenURI-specific restrictions
      if (error instanceof Error) {
        if (
          error.message.includes('OwnableUnauthorizedAccount') ||
          error.message.includes('caller is not the owner')
        ) {
          throw new Error(
            'Owner role required: The current private key does not have owner permissions on the contract',
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get the required USDC deposit amount
   */
  async getDepositCost(): Promise<bigint> {
    const contract = this.createTypedContract();
    const cost = await contract.read.depositCost();
    return cost as bigint;
  }

  /**
   * Get the cumulative USDC deposited by a specific FID
   */
  async getFidDeposited(fid: number): Promise<bigint> {
    const contract = this.createTypedContract();
    const deposited = await contract.read.fidToUsdcDeposited([BigInt(fid)]);
    return deposited as bigint;
  }

  /**
   * Get the USDC token address configured on the contract
   */
  async getUsdcAddress(): Promise<Address> {
    const contract = this.createTypedContract();
    const usdcAddress = await contract.read.usdc();
    return usdcAddress as Address;
  }

  /**
   * Get the contract's USDC balance
   */
  async getUsdcBalance(): Promise<bigint> {
    const contract = this.createTypedContract();
    const balance = await contract.read.getUsdcBalance();
    return balance as bigint;
  }

  /**
   * Check if a FID has deposited enough USDC to perform manual actions
   */
  async hasDepositedEnough(fid: number): Promise<boolean> {
    try {
      const [deposited, required] = await Promise.all([
        this.getFidDeposited(fid),
        this.getDepositCost(),
      ]);
      return deposited >= required;
    } catch (error) {
      console.error(`[ContractService] Failed to check deposit status for FID ${fid}:`, error);
      return false;
    }
  }

  /**
   * Get the actual minted token ID from a transaction receipt by parsing Transfer events.
   * Looks for Transfer events where from == zero address (minting) and returns the tokenId.
   *
   * @param txHash - The transaction hash to analyze
   * @returns The minted token ID as a number, or null if not found or on error
   */
  async getMintedTokenIdFromTx(txHash: `0x${string}`): Promise<number> {
    try {
      const publicClient = this.createPublicClient();

      // Poll for receipt with exponential backoff (max ~2.5–3s)
      let attempt = 0;
      const maxAttempts = 6;
      while (attempt < maxAttempts) {
        try {
          const receipt = await publicClient.getTransactionReceipt({
            hash: txHash,
          });
          if (receipt?.logs) {
            for (const log of receipt.logs) {
              try {
                if (log.address.toLowerCase() !== this.config.address.toLowerCase()) continue;
                const parsedLog = decodeEventLog({
                  abi: ChooChooTrainAbi,
                  data: log.data,
                  topics: log.topics,
                });

                // Prefer custom TicketStamped event for direct tokenId
                if (parsedLog.eventName === 'TicketStamped') {
                  const args = parsedLog.args as unknown as {
                    to: Address;
                    tokenId: bigint;
                  };
                  console.log(
                    `[ContractService] Found TicketStamped token ID ${Number(args.tokenId)} in tx: ${txHash}`,
                  );
                  return Number(args.tokenId);
                }

                // Fallback: standard ERC721 mint Transfer(from=0x0)
                if (parsedLog.eventName === 'Transfer') {
                  const args = parsedLog.args as unknown as {
                    from: Address;
                    to: Address;
                    tokenId: bigint;
                  };
                  if (args.from === '0x0000000000000000000000000000000000000000') {
                    console.log(
                      `[ContractService] Found minted token ID ${Number(args.tokenId)} in tx: ${txHash}`,
                    );
                    return Number(args.tokenId);
                  }
                }
              } catch {}
            }
            break;
          }
        } catch {}
        const delayMs = 300 * 1.5 ** attempt;
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
      }
      // If we got here, the receipt exists but has no mint events
      try {
        const finalReceipt = await publicClient.getTransactionReceipt({
          hash: txHash,
        });
        console.error(
          `[ContractService] Transaction ${txHash} receipt found but contains no mint events.`,
          {
            status: finalReceipt.status,
            gasUsed: finalReceipt.gasUsed.toString(),
            logs: finalReceipt.logs.length,
          },
        );

        if (finalReceipt.status === 'reverted') {
          throw new Error(
            `Transaction reverted on-chain. Status: ${finalReceipt.status}. This usually means the contract rejected the operation (e.g., recipient already rode train, sending to current holder, or other validation failure).`,
          );
        }
      } catch (receiptError) {
        console.error(
          `[ContractService] Could not fetch receipt for detailed error:`,
          receiptError,
        );
      }

      throw new Error(
        'Transaction receipt did not include a recognizable mint event. The transaction may have reverted on-chain.',
      );
    } catch (error) {
      console.error(`[ContractService] Failed to get minted token ID from tx ${txHash}:`, error);
      // Check if transaction exists at all
      try {
        const publicClient = this.createPublicClient();
        const tx = await publicClient.getTransaction({ hash: txHash });
        if (!tx) {
          throw new Error(
            `Transaction ${txHash} not found on-chain. It may not have been broadcast or is on a different network.`,
          );
        }
      } catch (txCheckError) {
        console.error(`[ContractService] Transaction check failed:`, txCheckError);
      }
      throw new Error(
        error instanceof Error
          ? error.message
          : `Failed to confirm minted token ID for transaction ${txHash}`,
      );
    }
  }

  /**
   * Get contract information and status using typed contract calls
   */
  async getContractInfo() {
    try {
      const contract = this.createTypedContract();

      // Use typed contract calls - now with full intellisense and compile-time safety!
      const [totalSupply, currentHolder, totalTickets, admins] = await Promise.all([
        contract.read.totalSupply(),
        contract.read.getCurrentTrainHolder(),
        contract.read.getTotalTickets(),
        contract.read.getAdmins(),
      ]);

      return {
        address: this.config.address,
        totalSupply: Number(totalSupply),
        totalTickets: Number(totalTickets),
        journeyLength: Number(totalTickets),
        nextTokenId: await this.getNextOnChainTicketId(),
        currentHolder,
        adminCount: (admins as Address[]).length,
        network: this.chain.name,
        healthy: true,
      };
    } catch (error) {
      return {
        address: this.config.address,
        network: this.chain.name,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
let contractService: ContractService | null = null;

export function getContractService(): ContractService {
  if (!contractService) {
    contractService = ContractService.fromEnv();
  }
  return contractService;
}
