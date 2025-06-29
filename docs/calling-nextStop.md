# Passing the Train: How to Call `nextStop` in ChooChooTrain

The ChooChooTrain contract is designed to let a unique NFT (the train) travel from wallet to wallet, leaving a trail of ticket NFTs as souvenirs. Users can either pass the train manually, or automate the process based on social interactions—like replies or likes on a Farcaster cast.

---

## Manual Transfer: Sending the Train Directly

The current passenger can choose to call the `nextStop(address to)` function, specifying the next passenger's wallet address in the mini-app.

```tsx
import { useWriteContract } from 'wagmi';
import { Abi } from 'viem';
import ChooChooTrainAbiJson from '@/abi/ChooChooTrain.abi.json';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';

const ChooChooAbi = ChooChooTrainAbiJson as Abi;

export function PassTrainButton({
  nextPassenger,
}: {
  nextPassenger: `0x${string}`;
}) {
  const { writeContractAsync, isPending, error } = useWriteContract();

  const handlePassTrain = async () => {
    try {
      await writeContractAsync({
        address: CHOOCHOO_TRAIN_ADDRESS as `0x${string}`,
        abi: ChooChooAbi,
        functionName: 'nextStop',
        args: [nextPassenger],
      });
      // Optionally show a success message
    } catch (err) {
      // Handle error
    }
  };

  return (
    <button onClick={handlePassTrain} disabled={isPending}>
      {isPending ? 'Sending...' : 'Pass the Train'}
    </button>
  );
}
```

> The `to` address must not have previously held the train (the contract enforces this).

---

## Transferring vis Cast Actions and Social Data

Choo-Choo is a social experience, and as such, the train can be moved based on Farcaster social actions—replies or likes on a cast. This is where the Neynar API comes in, allowing us to fetch social data and map Farcaster IDs (FIDs) to wallet addresses without having to sift through raw Farcaster data. The contract call is still triggered through the mini-app by the current holder, only after the app determines the next recipient.

### Example Flow

1. Current passenger makes a cast that the train is departing the station.
2. Other users reply to the cast.
3. After a set period, we fetch the list of eligible users.
4. Current passenger sends to train off, and a random eligible user receives the train next.

### Fetching Replies and Passing the Train

#### 1. Get the Cast Hash

When the train holder creates a cast, we record its hash (unique ID).

#### 2. Fetch Replies (or Likes) with Neynar

```ts
const castHash = '0x...'; // The original cast's hash
const apiKey = process.env.NEYNAR_API_KEY!;

export async function fetchReplies(): Promise<number[]> {
  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/cast/replies?cast_hash=${castHash}`,
    { headers: { 'x-api-key': apiKey } }
  );
  const data = await res.json();
  return data.result.casts.map((c: any) => c.author.fid);
}
```

#### 3. Map FIDs to Wallet Addresses

```ts
export async function fidsToWallets(
  fids: number[]
): Promise<{ fid: number; address: string }[]> {
  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(',')}`,
    { headers: { 'x-api-key': apiKey } }
  );
  const data = await res.json();
  return data.result.users
    .filter((u: any) => u.custody_address)
    .map((u: any) => ({ fid: u.fid, address: u.custody_address }));
}
```

#### 4. Select a Winner

```ts
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
```

#### 5. Call `nextStop` from the Backend

See [backend orchestration overview](/docs/nextStop-backend-orchestration.md) for more details.

---
