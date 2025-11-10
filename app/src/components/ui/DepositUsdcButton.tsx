'use client';

import { useEffect, useMemo } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { useDepositStatus } from '@/hooks/useDepositStatus';
import { useDepositUsdc } from '@/hooks/useDepositUsdc';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';

interface DepositUsdcButtonProps {
  fid: number | null | undefined;
  onDeposited?: () => void;
  className?: string;
}

export function DepositUsdcButton({ fid, onDeposited, className }: DepositUsdcButtonProps) {
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { isLoading, error, config, deposited, required, satisfied, refresh } =
    useDepositStatus(fid);

  const depositHook = useDepositUsdc({
    fid: fid ?? null,
    contractAddress: CHOOCHOO_TRAIN_ADDRESS,
    usdcAddress: (config?.usdcAddress ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
    required,
  });

  // When on-chain deposit is confirmed, notify and refresh
  useEffect(() => {
    if (depositHook.isDone) {
      onDeposited?.();
      void refresh();
    }
  }, [depositHook.isDone, onDeposited, refresh]);

  const primaryLabel = useMemo(() => {
    if (!isConnected) return 'Connect wallet';
    if (isLoading) return 'Loading...';
    if (!config) return 'Loading config...';
    if (satisfied) return 'Deposit complete';
    if (depositHook.isConfirming) return 'Confirming...';
    if (depositHook.isDepositing) return 'Depositing...';
    if (depositHook.isApproving) return 'Approving USDC...';
    if (depositHook.needsApproval) return 'Approve USDC';
    return `Deposit ${Number(required) / 10 ** (config?.decimals || 6)} USDC`;
  }, [
    isConnected,
    isLoading,
    config,
    satisfied,
    depositHook.isConfirming,
    depositHook.isDepositing,
    depositHook.isApproving,
    depositHook.needsApproval,
    required,
  ]);

  const disabled = useMemo(() => {
    if (!isConnected) return false; // allow opening connect modal upstream
    if (isLoading) return true;
    if (!config) return true;
    if (satisfied) return true;
    return false;
  }, [config, isConnected, isLoading, satisfied]);

  const onClick = async () => {
    if (!isConnected) return; // upstream should handle connect
    // Silent switch to desired network
    try {
      const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
      await switchChainAsync({
        chainId: useMainnet ? base.id : baseSepolia.id,
      });
    } catch {}
    if (depositHook.needsApproval) {
      await depositHook.approve();
      return;
    }
    await depositHook.deposit();
  };

  return (
    <Card className={className}>
      <Card.Content>
        <div className="space-y-2">
          <Typography variant="body">
            {satisfied
              ? 'You have deposited enough USDC to proceed.'
              : 'One-time deposit of 1 USDC required.'}
          </Typography>
          {error && <div className="text-xs text-red-500">{error}</div>}
          {depositHook.error && <div className="text-xs text-red-500">{depositHook.error}</div>}
          <Button onClick={onClick} disabled={disabled} isLoading={isSwitching} className="w-full">
            {primaryLabel}
          </Button>
          {!satisfied && config && (
            <Typography variant="small" className="text-gray-600">
              Required: {Number(required) / 10 ** config.decimals} USDC • Deposited:{' '}
              {Number(deposited) / 10 ** config.decimals} USDC
            </Typography>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
