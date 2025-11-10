import type { Abi } from 'viem';
import { useWriteContract, useReadContract } from 'wagmi';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';
import ChooChooAbiJson from '@/abi/ChooChooTrain.abi.json';
import { useContractTransaction } from './useContractTransaction';

const ChooChooAbi = ChooChooAbiJson as Abi;

type WriteFunction = (to: `0x${string}`) => Promise<void>;

export function useChooChoo() {
  // Write contract
  const { writeContractAsync } = useWriteContract();

  // Memoized contract config
  const contractConfig = {
    address: CHOOCHOO_TRAIN_ADDRESS as `0x${string}`,
    abi: ChooChooAbi,
  };

  // Transaction state for writes
  const nextStopTx = useContractTransaction();
  const yoinkTx = useContractTransaction();

  const createWriteFunction =
    (functionName: string, txHook: ReturnType<typeof useContractTransaction>): WriteFunction =>
    async (to) => {
      await txHook.sendTransaction(async () => {
        const hash = await writeContractAsync({
          ...contractConfig,
          functionName,
          args: [to],
        });
        return hash as string;
      });
    };

  const nextStop = createWriteFunction('nextStop', nextStopTx);
  const yoink = createWriteFunction('yoink', yoinkTx);

  // Reads
  const useOwner = () => useReadContract({ ...contractConfig, functionName: 'owner' });
  const useOwnerOf = (tokenId: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'ownerOf',
      args: [tokenId],
    });
  const useBalanceOf = (address: `0x${string}`) =>
    useReadContract({
      ...contractConfig,
      functionName: 'balanceOf',
      args: [address],
    });
  const useHasBeenPassenger = (address: `0x${string}`) =>
    useReadContract({
      ...contractConfig,
      functionName: 'hasBeenPassenger',
      args: [address],
    });
  const usePreviousPassenger = () =>
    useReadContract({ ...contractConfig, functionName: 'previousPassenger' });
  const useLastTransferTimestamp = () =>
    useReadContract({
      ...contractConfig,
      functionName: 'lastTransferTimestamp',
    });
  const useMainImage = () => useReadContract({ ...contractConfig, functionName: 'mainImage' });
  const useMainTokenURI = () =>
    useReadContract({ ...contractConfig, functionName: 'mainTokenURI' });
  const useTrainWhistle = () =>
    useReadContract({ ...contractConfig, functionName: 'getTrainWhistle' });
  const useTrainJourney = () =>
    useReadContract({ ...contractConfig, functionName: 'getTrainJourney' });
  const useTrainJourneyLength = () =>
    useReadContract({
      ...contractConfig,
      functionName: 'getTotalTickets',
    });
  const useTicketMintedAt = (tokenId: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'ticketMintedAt',
      args: [tokenId],
    });
  const useTicketMintedAtBatch = (tokenIds: bigint[]) =>
    useReadContract({
      ...contractConfig,
      functionName: 'getTicketMintedAtBatch',
      args: [tokenIds],
    });
  const useTokenURIBatch = (tokenIds: bigint[]) =>
    useReadContract({
      ...contractConfig,
      functionName: 'getTokenURIBatch',
      args: [tokenIds],
    });
  const useTicketData = (tokenId: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'ticketData',
      args: [tokenId],
    });
  const useIsYoinkable = (caller: `0x${string}`) =>
    useReadContract({
      ...contractConfig,
      functionName: 'isYoinkable',
      args: [caller],
    });
  const useTotalSupply = () => useReadContract({ ...contractConfig, functionName: 'totalSupply' });
  const useTokenByIndex = (index: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'tokenByIndex',
      args: [index],
    });
  const useTokenOfOwnerByIndex = (owner: `0x${string}`, index: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'tokenOfOwnerByIndex',
      args: [owner, index],
    });
  const useTokenURI = (tokenId: bigint) =>
    useReadContract({
      ...contractConfig,
      functionName: 'tokenURI',
      args: [tokenId],
    });
  const useSymbol = () => useReadContract({ ...contractConfig, functionName: 'symbol' });
  const useName = () => useReadContract({ ...contractConfig, functionName: 'name' });

  return {
    // write actions
    nextStop,
    nextStopTx,
    yoink,
    yoinkTx,
    // read hooks
    useOwner,
    useOwnerOf,
    useBalanceOf,
    useHasBeenPassenger,
    usePreviousPassenger,
    useLastTransferTimestamp,
    useMainImage,
    useMainTokenURI,
    useTrainWhistle,
    useTrainJourney,
    useTrainJourneyLength,
    useTicketMintedAt,
    useTicketMintedAtBatch,
    useTokenURIBatch,
    useTicketData,
    useIsYoinkable,
    useTotalSupply,
    useTokenByIndex,
    useTokenOfOwnerByIndex,
    useTokenURI,
    useSymbol,
    useName,
    address: CHOOCHOO_TRAIN_ADDRESS,
    abi: ChooChooAbi,
  };
}
