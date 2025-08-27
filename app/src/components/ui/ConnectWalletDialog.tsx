'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { Dialog } from '@/components/base/Dialog';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const { isConnected } = useAccount();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [internalError, setInternalError] = useState<string | null>(null);
  const { toast: marqueeToast } = useMarqueeToast();

  const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
  const desiredChainId = useMainnet ? base.id : baseSepolia.id;

  useEffect(() => {
    // Do not auto-close if we have an inline error (e.g., chain switch failed)
    if (isConnected && open && !internalError) {
      marqueeToast({ description: 'Wallet connected successfully' });
      onOpenChange(false);
    }
  }, [isConnected, open, internalError, onOpenChange, marqueeToast]);

  const orderedConnectors = useMemo(() => {
    const order = ['farcasterFrame', 'coinbaseWallet', 'metaMask'];
    return [...connectors].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [connectors]);

  async function handleConnect(id: string) {
    setInternalError(null);
    try {
      const target = orderedConnectors.find((c) => c.id === id);
      if (!target) {
        setInternalError('Selected connector is not available');
        return;
      }
      await connect({ connector: target });
      // Silent chain switch after connection if needed
      try {
        await switchChainAsync({ chainId: desiredChainId });
      } catch {
        setInternalError('Please switch to Base to continue');
        // keep dialog open so user can retry switch/connect
        return;
      }
      marqueeToast({ description: 'Wallet connected successfully' });
    } catch (e) {
      setInternalError(e instanceof Error ? e.message : 'Failed to connect');
      marqueeToast({ description: 'Wallet connection failed', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        size="sm"
        title="Connect Wallet"
        className="!bg-purple-700 !text-white !border-white"
      >
        <div className="p-4 space-y-3">
          <Typography variant="h5" className="font-comic !text-white">
            Connect your wallet
          </Typography>

          {orderedConnectors.map((connector) => (
            <Button
              key={connector.uid}
              onClick={() => handleConnect(connector.id)}
              className="w-full !bg-purple-500 hover:!bg-purple-600 !text-white !border-2 !border-white"
              isLoading={isPending}
            >
              {connector.name}
            </Button>
          ))}

          {(internalError || connectError) && (
            <div className="text-xs text-red-200">
              {internalError || (connectError as Error)?.message}
            </div>
          )}

          {(isPending || isSwitching) && (
            <Typography variant="small" className="!text-white opacity-90">
              {isSwitching ? 'Switching to Base...' : 'Connecting...'}
            </Typography>
          )}
        </div>

        <Dialog.Footer position="static">
          <Button
            variant="noShadow"
            onClick={() => onOpenChange(false)}
            className="!bg-purple-500 hover:!bg-purple-600 !text-white !border-2 !border-white"
          >
            Close
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

interface ConnectWalletButtonProps {
  className?: string;
}

export function ConnectWalletButton({ className }: ConnectWalletButtonProps) {
  const [open, setOpen] = useState(false);
  const { isConnected } = useAccount();
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className} disabled={isConnected}>
        {isConnected ? 'Connected' : 'Connect wallet'}
      </Button>
      <ConnectWalletDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
