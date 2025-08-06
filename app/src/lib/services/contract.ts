import { createPublicClient, createWalletClient, http, Address, type Abi, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
  async hasRiddenTrain(address: Address): Promise<boolean> {
    const contract = this.createTypedContract();
    const hasRidden = await contract.read.hasRiddenTrain([address]);
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
   * Get the train journey length (number of stops made)
   */
  async getTrainJourneyLength(): Promise<number> {
    const contract = this.createTypedContract();
    const journeyLength = await contract.read.getTrainJourneyLength();
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
   * Execute the nextStopWithTicketData function on the contract
   * This is the new function that moves the train and sets ticket metadata in one transaction
   * @todo: use coinbase paymaster to cover gas costs
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
   * Get contract information and status using typed contract calls
   */
  async getContractInfo() {
    try {
      const contract = this.createTypedContract();

      // Use typed contract calls - now with full intellisense and compile-time safety!
      const [totalSupply, currentHolder, totalTickets, journeyLength, admins] = await Promise.all([
        contract.read.totalSupply(),
        contract.read.getCurrentTrainHolder(),
        contract.read.getTotalTickets(),
        contract.read.getTrainJourneyLength(),
        contract.read.getAdmins(),
      ]);

      return {
        address: this.config.address,
        totalSupply: Number(totalSupply),
        totalTickets: Number(totalTickets),
        journeyLength: Number(journeyLength),
        nextTokenId: Number(totalSupply) + 1,
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
