import { createPublicClient, createWalletClient, http, Address, type Abi, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'wagmi/chains';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';

const ChooChooTrainAbi = ChooChooTrainAbiJson as Abi;

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

  private createPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Read the current total supply from the contract
   */
  async getTotalSupply(): Promise<number> {
    const publicClient = this.createPublicClient();

    const totalSupply = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'totalSupply',
    });

    return Number(totalSupply);
  }

  /**
   * Get the current train holder address
   */
  async getCurrentTrainHolder(): Promise<Address> {
    const publicClient = this.createPublicClient();

    const holder = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'getCurrentTrainHolder',
    });

    return holder as Address;
  }

  /**
   * Get comprehensive train status information
   */
  async getTrainStatus(): Promise<TrainStatus> {
    const publicClient = this.createPublicClient();

    const status = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'getTrainStatus',
    });

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
  async hasRiddenTrain(address: Address): Promise<boolean> {
    const publicClient = this.createPublicClient();

    const hasRidden = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'hasRiddenTrain',
      args: [address],
    });

    return hasRidden as boolean;
  }

  /**
   * Get the total number of tickets minted
   */
  async getTotalTickets(): Promise<number> {
    const publicClient = this.createPublicClient();

    const totalTickets = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'getTotalTickets',
    });

    return Number(totalTickets);
  }

  /**
   * Get list of admin addresses
   */
  async getAdmins(): Promise<Address[]> {
    const publicClient = this.createPublicClient();

    const admins = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'getAdmins',
    });

    return admins as Address[];
  }

  /**
   * Execute the nextStopWithTicketData function on the contract
   * This is the new function that moves the train and sets ticket metadata in one transaction
   * @todo: use coinbase paymaster instead of admin private key
   */
  async executeNextStop(recipient: Address, tokenURI: string): Promise<`0x${string}`> {
    if (!this.config.adminPrivateKey) {
      throw new Error(
        'Missing ADMIN_PRIVATE_KEY for contract execution. Admin role required for train movement.'
      );
    }

    try {
      const account = privateKeyToAccount(this.config.adminPrivateKey);
      const walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.config.rpcUrl),
      });

      const contract = getContract({
        address: this.config.address,
        abi: ChooChooTrainAbi,
        client: walletClient,
      });

      const hash = await contract.write.nextStopWithTicketData([recipient, tokenURI]);
      return hash;
    } catch (error) {
      // Enhanced error handling for admin-only restrictions
      if (error instanceof Error) {
        if (error.message.includes('AccessControlUnauthorizedAccount')) {
          throw new Error(
            'Admin role required: The current private key does not have ADMIN_ROLE permissions on the contract'
          );
        }
        if (error.message.includes('AlreadyRodeTrain')) {
          throw new Error(
            `Recipient ${recipient} has already ridden the train and cannot receive it again`
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
   * Estimate gas for the nextStopWithTicketData transaction
   */
  async estimateNextStopGas(recipient: Address, tokenURI: string): Promise<bigint> {
    if (!this.config.adminPrivateKey) {
      throw new Error('Missing ADMIN_PRIVATE_KEY for gas estimation');
    }

    const account = privateKeyToAccount(this.config.adminPrivateKey);
    const publicClient = this.createPublicClient();

    const gasEstimate = await publicClient.estimateContractGas({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'nextStopWithTicketData',
      args: [recipient, tokenURI],
      account,
    });

    return gasEstimate;
  }

  /**
   * Get contract information and status
   */
  async getContractInfo() {
    try {
      const [totalSupply, currentHolder, totalTickets, admins] = await Promise.all([
        this.getTotalSupply(),
        this.getCurrentTrainHolder(),
        this.getTotalTickets(),
        this.getAdmins(),
      ]);

      return {
        address: this.config.address,
        totalSupply,
        totalTickets,
        nextTokenId: totalSupply + 1,
        currentHolder,
        adminCount: admins.length,
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
