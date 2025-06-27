import { Abi } from 'viem';
import { useWriteContract, useReadContract } from 'wagmi';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';
import ChooChooAbiJson from '@/abi/ChooChooTrain.abi.json';
import { useContractTransaction } from './useContractTransaction';

const ChooChooAbi = ChooChooAbiJson as Abi;

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

  // Write: nextStop
  const nextStop = async (to: `0x${string}`) => {
    await nextStopTx.sendTransaction(async () => {
      const hash = await writeContractAsync({
        ...contractConfig,
        functionName: 'nextStop',
        args: [to],
      });
      return hash as string;
    });
  };

  // Write: yoink
  const yoink = async (to: `0x${string}`) => {
    await yoinkTx.sendTransaction(async () => {
      const hash = await writeContractAsync({
        ...contractConfig,
        functionName: 'yoink',
        args: [to],
      });
      return hash as string;
    });
  };

  // Read helpers using useReadContract
  const useOwner = () =>
    useReadContract({ ...contractConfig, functionName: 'owner' });
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
  const useMainImage = () =>
    useReadContract({ ...contractConfig, functionName: 'mainImage' });
  const useMainTokenURI = () =>
    useReadContract({ ...contractConfig, functionName: 'mainTokenURI' });
  const useTrainWhistle = () =>
    useReadContract({ ...contractConfig, functionName: 'getTrainWhistle' });
  const useTrainJourney = () =>
    useReadContract({ ...contractConfig, functionName: 'getTrainJourney' });
  const useTrainJourneyLength = () =>
    useReadContract({
      ...contractConfig,
      functionName: 'getTrainJourneyLength',
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
  const useTotalSupply = () =>
    useReadContract({ ...contractConfig, functionName: 'totalSupply' });
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
  const useSymbol = () =>
    useReadContract({ ...contractConfig, functionName: 'symbol' });
  const useName = () =>
    useReadContract({ ...contractConfig, functionName: 'name' });

  return {
    // Write actions
    nextStop,
    nextStopTx,
    yoink,
    yoinkTx,
    // Read hooks
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
    // Contract address and ABI (for UI/debugging)
    address: CHOOCHOO_TRAIN_ADDRESS,
    abi: ChooChooAbi,
  };
}
