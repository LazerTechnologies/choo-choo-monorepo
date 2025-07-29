import { createPublicClient, createWalletClient, http, Address, type Abi, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'wagmi/chains';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';

const ChooChooTrainAbi = ChooChooTrainAbiJson as Abi;

// @todo: remove admin private key in favor of coinbase paymaster
interface ContractConfig {
  address: Address;
  rpcUrl: string;
  adminPrivateKey?: `0x${string}`;
  useMainnet: boolean;
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

  /**
   * Read the current total supply from the contract
   */
  async getTotalSupply(): Promise<number> {
    const publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });

    const totalSupply = await publicClient.readContract({
      address: this.config.address,
      abi: ChooChooTrainAbi,
      functionName: 'totalSupply',
    });

    return Number(totalSupply);
  }

  /**
   * Execute the nextStop function on the contract
   * @todo: use coinbase paymaster instead of admin private key
   */
  async executeNextStop(recipient: Address, tokenURI: string): Promise<`0x${string}`> {
    if (!this.config.adminPrivateKey) {
      throw new Error('Missing ADMIN_PRIVATE_KEY for contract execution');
    }

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

    const hash = await contract.write.nextStop([recipient, tokenURI]);
    return hash;
  }

  /**
   * Get contract information and status
   */
  async getContractInfo() {
    try {
      const totalSupply = await this.getTotalSupply();

      // You can add more contract reads here
      return {
        address: this.config.address,
        totalSupply,
        nextTokenId: totalSupply + 1,
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
