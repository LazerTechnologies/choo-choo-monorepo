import { NextResponse } from 'next/server';
import { createPublicClient, http, Address, type Abi } from 'viem';
import { base, baseSepolia } from 'wagmi/chains';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';

const ChooChooTrainAbi = ChooChooTrainAbiJson as Abi;

const CHOOCHOO_TRAIN_ADDRESS = process.env.CHOOCHOO_TRAIN_ADDRESS as Address;
const RPC_URL = process.env.RPC_URL as string;
const useMainnet = process.env.USE_MAINNET === 'true';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

const validateEnvironment = () => {
  const missing = [];
  if (!CHOOCHOO_TRAIN_ADDRESS) missing.push('CHOOCHOO_TRAIN_ADDRESS');
  if (!RPC_URL) missing.push('RPC_URL');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

/**
 * GET /api/internal/next-stop/read
 * Internal-only endpoint to get the current total supply from the contract.
 */
export async function GET(request: Request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    validateEnvironment();

    const chain = useMainnet ? base : baseSepolia;

    const publicClient = createPublicClient({
      chain,
      transport: http(RPC_URL),
    });

    const totalSupply = await publicClient.readContract({
      address: CHOOCHOO_TRAIN_ADDRESS,
      abi: ChooChooTrainAbi,
      functionName: 'totalSupply',
    });

    return NextResponse.json({ totalSupply: Number(totalSupply) });
  } catch (error) {
    console.error('Failed to get total supply:', error);
    return NextResponse.json({ error: 'Failed to get total supply.' }, { status: 500 });
  }
}
