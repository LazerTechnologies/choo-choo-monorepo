'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, erc20Abi } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';

interface UseDepositUsdcOptions {
  fid: number | null | undefined;
  contractAddress: Address; // ChooChooTrain address
  usdcAddress: Address; // USDC token address
  required: bigint; // required amount in smallest unit
}

interface UseDepositUsdcResult {
  isApproving: boolean;
  isDepositing: boolean;
  isConfirming: boolean;
  isDone: boolean;
  error: string | null;
  allowance: bigint | null;
  needsApproval: boolean;
  approve: () => Promise<void>;
  deposit: () => Promise<void>;
  reset: () => void;
}

export function useDepositUsdc(opts: UseDepositUsdcOptions): UseDepositUsdcResult {
  const { fid, contractAddress, usdcAddress, required } = opts;
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsApproval = useMemo(() => {
    if (allowance === null) return true;
    return allowance < required;
  }, [allowance, required]);

  const readAllowance = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const value = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, contractAddress],
      });
      setAllowance(value as bigint);
    } catch {
      setAllowance(0n);
    }
  }, [address, contractAddress, publicClient, usdcAddress]);

  const approve = useCallback(async () => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }
    setError(null);
    setIsApproving(true);
    try {
      if (!publicClient) {
        setError('RPC client unavailable');
        setIsApproving(false);
        return;
      }
      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddress, required],
        chain: walletClient.chain,
        account: address,
      });
      setIsConfirming(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirming(false);
      await readAllowance();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  }, [address, contractAddress, publicClient, readAllowance, required, usdcAddress, walletClient]);

  const deposit = useCallback(async () => {
    if (!walletClient || !address || !fid) {
      setError(!fid ? 'Missing FID' : 'Wallet not connected');
      return;
    }
    setError(null);
    setIsDepositing(true);
    try {
      if (!publicClient) {
        setError('RPC client unavailable');
        setIsDepositing(false);
        return;
      }
      // depositUSDC(uint256 fid, uint256 amount)
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: [
          {
            type: 'function',
            name: 'depositUSDC',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'fid', type: 'uint256' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
          },
        ],
        functionName: 'depositUSDC',
        args: [BigInt(fid), required],
        chain: walletClient.chain,
        account: address,
      });
      setIsConfirming(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirming(false);
      setIsDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  }, [address, contractAddress, fid, publicClient, required, walletClient]);

  const reset = useCallback(() => {
    setIsApproving(false);
    setIsDepositing(false);
    setIsConfirming(false);
    setIsDone(false);
    setError(null);
  }, []);

  // Auto-read allowance when dependencies change
  useEffect(() => {
    void readAllowance();
  }, [readAllowance]);

  return {
    isApproving,
    isDepositing,
    isConfirming,
    isDone,
    error,
    allowance,
    needsApproval,
    approve,
    deposit,
    reset,
  };
}
