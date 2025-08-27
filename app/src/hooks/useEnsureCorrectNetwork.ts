'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSwitchChain, useWalletClient } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

interface EnsureResult {
  ensureCorrectNetwork: () => Promise<boolean>;
  isSwitching: boolean;
  desiredChainId: number;
}

export function useEnsureCorrectNetwork(): EnsureResult {
  const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
  const desiredChainId = useMainnet ? base.id : baseSepolia.id;
  const { switchChainAsync, isPending } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [softSwitching, setSoftSwitching] = useState(false);

  const isSwitching = useMemo(() => isPending || softSwitching, [isPending, softSwitching]);

  const ensureCorrectNetwork = useCallback(async () => {
    try {
      // If wallet already on desired chain, done
      if (walletClient?.chain?.id === desiredChainId) return true;

      // Try wagmi switch first
      try {
        await switchChainAsync({ chainId: desiredChainId });
        return true;
      } catch {}

      // Fallback to walletClient.switchChain if available
      if (walletClient?.switchChain) {
        setSoftSwitching(true);
        try {
          await walletClient.switchChain({ id: desiredChainId });
          return true;
        } finally {
          setSoftSwitching(false);
        }
      }
    } catch {}
    return false;
  }, [desiredChainId, switchChainAsync, walletClient]);

  return { ensureCorrectNetwork, isSwitching, desiredChainId };
}
