/** INTERNAL ENDPOINT — Only callable by backend jobs/services. Never expose to frontend or users. */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient, http, isAddress, Address, type Abi, getContract, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'wagmi/chains';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';

const ChooChooTrainAbi = ChooChooTrainAbiJson as Abi;

const CHOOCHOO_TRAIN_ADDRESS = process.env.CHOOCHOO_TRAIN_ADDRESS as Address;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL as string;
const useMainnet = process.env.USE_MAINNET === 'true';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const bodySchema = z.object({
  recipient: addressSchema,
  tokenURI: z.string().refine((val) => val.startsWith('ipfs://'), {
    message: 'tokenURI must be an IPFS URI',
  }),
});

const validateEnvironment = () => {
  const missing = [];
  if (!CHOOCHOO_TRAIN_ADDRESS) missing.push('CHOOCHOO_TRAIN_ADDRESS');
  if (!RPC_URL) missing.push('RPC_URL');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

/**
 * GET /api/internal/next-stop
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

/**
 * POST /api/internal/next-stop
 * Internal-only endpoint to call nextStop on the contract using the admin key.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { recipient, tokenURI } = parsed.data as { recipient: Address; tokenURI: string };

    validateEnvironment();
    if (!ADMIN_PRIVATE_KEY) throw new Error('Missing ADMIN_PRIVATE_KEY');

    const chain = useMainnet ? base : baseSepolia;

    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
    const client = createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });

    const contract = getContract({
      address: CHOOCHOO_TRAIN_ADDRESS,
      abi: ChooChooTrainAbi,
      client,
    });

    const hash = await contract.write.nextStop([recipient, tokenURI]);

    return NextResponse.json({ success: true, txHash: hash });
  } catch (error) {
    console.error('Failed to call nextStop:', error);
    return NextResponse.json({ error: 'Failed to call nextStop.' }, { status: 500 });
  }
}
