/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn, signOut, getCsrfToken } from 'next-auth/react';
import sdk, { SignIn as SignInCore, type Haptics } from '@farcaster/frame-sdk';
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from 'wagmi';
import { ShareButton } from './ui/Share';
import { config } from '@/components/providers/WagmiProvider';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Input } from '@/components/base/Input';
import { truncateAddress } from '@/lib/truncateAddress';
import { base, degen, mainnet, optimism, unichain } from 'wagmi/chains';
import { BaseError, UserRejectedRequestError } from 'viem';
import { useSession } from 'next-auth/react';
import { useMiniApp } from '@neynar/react';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { YoinkDialog } from '@/components/ui/dialogs/YoinkDialog';
import { JourneyTimeline } from '@/components/ui/timeline';
import { CurrentHolderItem } from '@/components/ui/timeline/CurrentHolderItem';
import { useSoundPlayer } from '@/hooks/useSoundPlayer';
import { Typography } from '@/components/base/Typography';
import { USE_WALLET, APP_NAME } from '@/lib/constants';
import Image from 'next/image';
import type { PinataUploadResult } from '@/types/nft';

export type Tab = 'home' | 'actions' | 'context' | 'wallet';

interface NeynarUser {
  fid: number;
  score: number;
}

// @todo: remove this once we move to prod
function TestRedis({ onCurrentHolderUpdated }: { onCurrentHolderUpdated: () => void }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggle, setToggle] = useState(false);
  const { playChooChoo } = useSoundPlayer();

  async function handleWrite() {
    setLoading(true);
    setError(null);
    try {
      const currentHolderData = toggle
        ? {
            fid: 2802,
            username: 'garrett',
            displayName: 'garrett',
            pfpUrl:
              'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/c131c034-0090-4610-45a4-acda4b805000/anim=false,fit=contain,f=auto,w=576',
            address: '0xcEaB0087c5fbC22fb19293bd0be5Fa9B23789DA9',
            timestamp: new Date().toISOString(),
          }
        : {
            fid: 377557,
            username: 'jonbray.eth',
            displayName: 'jon',
            pfpUrl:
              'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/52e69c12-87d6-4d32-cf3d-dafc097fec00/anim=false,fit=contain,f=auto,w=576',
            address: '0xef00A763368C98C361a9a30cE44D24c8Fed43844',
            timestamp: new Date().toISOString(),
          };

      const res = await fetch('/api/redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          key: 'current-holder',
          value: JSON.stringify(currentHolderData),
        }),
      });
      const data = await res.json();
      setValue(data.value || null);

      // Trigger refresh of CurrentHolderItem
      onCurrentHolderUpdated();

      // Play choo-choo sound when current holder is set
      playChooChoo({ volume: 0.7 });
      setToggle((t) => !t);
    } catch (e) {
      setError('Write failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <h3 className="font-bold mb-2 text-white dark:text-white">Set Current Holder</h3>
      <div className="mb-2">
        <button
          className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 w-full border-white"
          onClick={handleWrite}
          disabled={loading}
        >
          Set Current Holder ({toggle ? 'garrett' : 'jonbray.eth'})
        </button>
      </div>
      {loading && <div className="text-xs text-gray-500">Setting current holder...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {value && (
        <div className="text-xs mt-2 text-green-600">✅ Current holder data set successfully</div>
      )}
    </div>
  );
}

function TestPinata() {
  const [result, setResult] = useState<(PinataUploadResult & { message?: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUploadToPinata() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/test-pinata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (e) {
      setError('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <h3 className="font-bold mb-2">Test Pinata (Generator)</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Generate a new NFT using the generator package and upload to Pinata
      </p>
      <div className="mb-2">
        <Button
          onClick={handleUploadToPinata}
          disabled={loading}
          className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 w-full border-white"
          variant="default"
        >
          Generate & Upload NFT
        </Button>
      </div>
      {loading && <div className="text-xs text-gray-500">Uploading...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {result && (
        <div className="text-xs mt-2 space-y-2">
          <div className="text-green-600 dark:text-green-400">{result.message}</div>

          <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
            <div className="font-semibold mb-1">Image:</div>
            <div>
              Hash: <span className="font-mono">{result.imageHash}</span>
            </div>
            {result.imageUrl && (
              <div>
                URL:{' '}
                <a
                  href={result.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs break-all"
                >
                  {result.imageUrl}
                </a>
              </div>
            )}
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
            <div className="font-semibold mb-1">Metadata:</div>
            <div>
              Hash: <span className="font-mono">{result.metadataHash}</span>
            </div>
            {result.metadataUrl && (
              <div>
                URL:{' '}
                <a
                  href={result.metadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs break-all"
                >
                  {result.metadataUrl}
                </a>
              </div>
            )}
            {result.tokenURI && (
              <div>
                Token URI: <span className="font-mono">{result.tokenURI}</span>
              </div>
            )}
          </div>

          {result.metadata && (
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
              <div className="font-semibold mb-1">Uploaded Metadata:</div>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestAdminNextStop({ onTokenMinted }: { onTokenMinted?: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [tokenURI, setTokenURI] = useState('');
  const [result, setResult] = useState<{
    txHash: string;
    recipient: string;
    tokenURI: string;
    contractInfo: {
      address: string;
      network: string;
      currentSupply: number;
      nextTokenId: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteNextStop = useCallback(async () => {
    if (!recipient.trim()) {
      setError('Please enter a recipient address');
      return;
    }
    if (!tokenURI.trim()) {
      setError('Please enter a token URI or IPFS hash');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/test-admin-nextstop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipient.trim(),
          tokenURI: tokenURI.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data);
        onTokenMinted?.();
      } else {
        setError(data.error || 'Failed to execute nextStop');
      }
    } catch (e) {
      setError('Failed to execute nextStop');
    } finally {
      setLoading(false);
    }
  }, [recipient, tokenURI, onTokenMinted]);

  return (
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Test Admin NextStop Function</Card.Title>
        <Card.Description>
          Manually execute the nextStop function as an admin (requires ADMIN_PRIVATE_KEY)
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient Address
            </label>
            <Input
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token URI / IPFS Hash
            </label>
            <Input
              type="text"
              placeholder="QmXXXXXX... or ipfs://QmXXXXXX..."
              value={tokenURI}
              onChange={(e) => setTokenURI(e.target.value)}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              Enter IPFS hash or full URI. ipfs:// prefix will be added automatically if needed.
            </div>
          </div>

          <Button
            onClick={handleExecuteNextStop}
            disabled={loading || !recipient.trim() || !tokenURI.trim()}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            🚂 Execute NextStop
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs space-y-2 border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div className="text-green-600 dark:text-green-400 font-semibold">
              ✅ Transaction Submitted Successfully!
            </div>

            <div>
              <span className="font-semibold">Transaction Hash:</span>
              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded mt-1 break-all">
                {result.txHash}
              </div>
            </div>

            <div>
              <span className="font-semibold">Recipient:</span>{' '}
              <code className="text-xs">{result.recipient}</code>
            </div>

            <div>
              <span className="font-semibold">Token URI:</span>{' '}
              <code className="text-xs break-all">{result.tokenURI}</code>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <div className="font-semibold mb-1">Contract Info:</div>
              <div>
                <strong>Address:</strong> {result.contractInfo.address}
              </div>
              <div>
                <strong>Network:</strong> {result.contractInfo.network}
              </div>
              <div>
                <strong>Total Supply:</strong> {result.contractInfo.currentSupply}
              </div>
              <div>
                <strong>Next Token ID:</strong> {result.contractInfo.nextTokenId}
              </div>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

export default function Home({ title }: { title?: string } = { title: 'Choo Choo on Base' }) {
  const {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    actions,
    setInitialTab,
    setActiveTab,
    currentTab,
    haptics,
  } = useMiniApp();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [hapticIntensity, setHapticIntensity] = useState<Haptics.ImpactOccurredType>('medium');
  const [isYoinkDialogOpen, setIsYoinkDialogOpen] = useState(false);
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Set initial tab to home on page load
  useEffect(() => {
    if (isSDKLoaded) {
      setInitialTab('home');
    }
  }, [isSDKLoaded, setInitialTab]);

  useEffect(() => {
    console.log('isSDKLoaded', isSDKLoaded);
    console.log('context', context);
    console.log('address', address);
    console.log('isConnected', isConnected);
    console.log('chainId', chainId);
  }, [context, address, isConnected, chainId, isSDKLoaded]);

  // Fetch Neynar user object when context is available
  useEffect(() => {
    const fetchNeynarUserObject = async () => {
      if (context?.user?.fid) {
        try {
          const response = await fetch(`/api/users?fids=${context.user.fid}`);
          const data = await response.json();
          if (data.users?.[0]) {
            setNeynarUser(data.users[0]);
          }
        } catch (error) {
          console.error('Failed to fetch Neynar user object:', error);
        }
      }
    };

    fetchNeynarUserObject();
  }, [context?.user?.fid]);

  const {
    sendTransaction,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  const {
    switchChain,
    error: switchChainError,
    isError: isSwitchChainError,
    isPending: isSwitchChainPending,
  } = useSwitchChain();

  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism;
    } else if (chainId === optimism.id) {
      return degen;
    } else if (chainId === degen.id) {
      return mainnet;
    } else if (chainId === mainnet.id) {
      return unichain;
    } else {
      return base;
    }
  }, [chainId]);

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id });
  }, [switchChain, nextChain.id]);

  const handleYoinkClick = useCallback(() => {
    setIsYoinkDialogOpen(true);
  }, []);

  const sendTx = useCallback(() => {
    sendTransaction(
      {
        // call yoink() on Yoink contract
        to: '0x4bBFD120d9f352A0BEd7a014bd67913a2007a878',
        data: '0x9846cd9efc000023c0',
      },
      {
        onSuccess: (hash: string) => {
          setTxHash(hash);
        },
      }
    );
  }, [sendTransaction]);

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: APP_NAME,
        version: '1',
        chainId,
      },
      types: {
        Message: [{ name: 'content', type: 'string' }],
      },
      message: {
        content: `Hello from ${APP_NAME}!`,
      },
      primaryType: 'Message',
    });
  }, [chainId, signTypedData]);

  const toggleContext = useCallback(() => {
    setIsContextOpen((prev) => !prev);
  }, []);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <Header neynarUser={neynarUser} />

      <div className="mx-auto py-2 px-4 pt-16 pb-24">
        <h1 className="text-2xl font-bold text-center mb-4">{title}</h1>

        {/* Hidden CurrentHolderItem - always mounted to detect changes */}
        {/* @todo: remove this once we move to prod */}
        <div className="hidden">
          <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
        </div>

        {currentTab === 'home' && (
          <div className="overflow-y-auto h-[calc(100vh-200px)] px-6">
            <div className="flex flex-col items-center justify-center py-8">
              <h2 className="text-2xl font-bold mb-4">{title}</h2>
              <Image
                src="/ChooChoo.webp"
                alt="ChooChoo App Logo"
                width={320}
                height={320}
                priority
                className="rounded-lg shadow-lg border-4"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>

            {/* App Description */}
            <div className="pb-6 text-center px-4">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                ChooChoo is a train trying to visit every wallet on Base! The community decides each
                stop on the journey. When ChooChoo visits a new wallet, he sends out a cast. Replies
                to that cast compete for the most reactions, and the winner receives ChooChoo next.
                All aboard!
              </p>
            </div>

            {/* Current Stop Section */}
            <div className="w-full max-w-md mx-auto mb-8">
              <Typography
                variant="h3"
                className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
              >
                Current Stop
              </Typography>
              <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
            </div>

            {/* Test Sections */}
            {/* Next Stop Trigger */}
            {/* 
            <div className="pb-8 px-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-center">Trigger Next Stop</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Select the next stop winner from the latest cast and mint their NFT ticket
                </p>
                <NextStopTrigger />
              </div>
            </div>
            */}

            <div className="pb-8">
              <JourneyTimeline refreshOnMintTrigger={timelineRefreshTrigger} />
            </div>

            {/* Credits Section */}
            <div className="pb-8 border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
              <div className="text-center space-y-2">
                <p className="text-sm text-white dark:text-white">
                  Artwork by{' '}
                  <a
                    href="https://farcaster.xyz/yonfrula"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    @yonfrula
                  </a>
                </p>
                <p className="text-sm text-white dark:text-white">
                  Built by{' '}
                  <a
                    href="https://farcaster.xyz/jonbray.eth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    @jonbray.eth
                  </a>
                </p>
                <p className="text-sm text-white dark:text-white">Powered by Base 🔵</p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'actions' && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {/* Admin Test Sections */}
            <TestRedis
              onCurrentHolderUpdated={() => setTimelineRefreshTrigger((prev) => prev + 1)}
            />
            <TestPinata />
            {/* @todo: move TestAdminNextStop into it's own component that uses farcaster session to detect the FID of the current user, if admin, display the component in the footer as a dialog that opens when the button is clicked */}
            <TestAdminNextStop
              onTokenMinted={() => setTimelineRefreshTrigger((prev) => prev + 1)}
            />

            {/* Existing Actions */}
            <ShareButton
              buttonText="Share Mini App"
              cast={{
                text: 'Check out this awesome frame @1 @2 @3! 🚀🪐',
                bestFriends: true,
                embeds: [`${process.env.NEXT_PUBLIC_URL}/share/${context?.user?.fid || ''}`],
              }}
              className="w-full"
            />

            <SignIn />

            <Button
              onClick={() => actions.openUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
              className="w-full"
            >
              Open Link
            </Button>

            <Button onClick={actions.addMiniApp} disabled={added} className="w-full">
              Add Mini App to Client
            </Button>

            <Button
              onClick={async () => {
                if (context?.user?.fid) {
                  const shareUrl = `${process.env.NEXT_PUBLIC_URL}/share/${context.user.fid}`;
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              disabled={!context?.user?.fid}
              className="w-full"
            >
              {copied ? 'Copied!' : 'Copy share URL'}
            </Button>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Haptic Intensity
              </label>
              <select
                value={hapticIntensity}
                onChange={(e) => setHapticIntensity(e.target.value as typeof hapticIntensity)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
                <option value="soft">Soft</option>
                <option value="rigid">Rigid</option>
              </select>
              <Button
                onClick={async () => {
                  try {
                    await haptics.impactOccurred(hapticIntensity);
                  } catch (error) {
                    console.error('Haptic feedback failed:', error);
                  }
                }}
                className="w-full"
              >
                Trigger Haptic Feedback
              </Button>
            </div>
          </div>
        )}

        {currentTab === 'context' && (
          <div className="mx-6">
            <h2 className="text-lg font-semibold mb-2">Context</h2>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words w-full">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {currentTab === 'wallet' && USE_WALLET && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {address && (
              <div className="text-xs w-full">
                Address: <pre className="inline w-full">{truncateAddress(address)}</pre>
              </div>
            )}

            {chainId && (
              <div className="text-xs w-full">
                Chain ID: <pre className="inline w-full">{chainId}</pre>
              </div>
            )}

            {isConnected ? (
              <Button onClick={() => disconnect()} className="w-full">
                Disconnect
              </Button>
            ) : context ? (
              <Button onClick={() => connect({ connector: connectors[0] })} className="w-full">
                Connect
              </Button>
            ) : (
              <div className="space-y-3 w-full">
                <Button onClick={() => connect({ connector: connectors[1] })} className="w-full">
                  Connect Coinbase Wallet
                </Button>
                <Button onClick={() => connect({ connector: connectors[2] })} className="w-full">
                  Connect MetaMask
                </Button>
              </div>
            )}

            <SignEvmMessage />

            {isConnected && (
              <>
                <SendEth />
                <Button
                  onClick={sendTx}
                  disabled={!isConnected || isSendTxPending}
                  isLoading={isSendTxPending}
                  className="w-full"
                >
                  Send Transaction (contract)
                </Button>
                {isSendTxError && renderError(sendTxError)}
                {txHash && (
                  <div className="text-xs w-full">
                    <div>Hash: {truncateAddress(txHash)}</div>
                    <div>
                      Status:{' '}
                      {isConfirming ? 'Confirming...' : isConfirmed ? 'Confirmed!' : 'Pending'}
                    </div>
                  </div>
                )}
                <Button
                  onClick={signTyped}
                  disabled={!isConnected || isSignTypedPending}
                  isLoading={isSignTypedPending}
                  className="w-full"
                >
                  Sign Typed Data
                </Button>
                {isSignTypedError && renderError(signTypedError)}
                <Button
                  onClick={handleSwitchChain}
                  disabled={isSwitchChainPending}
                  isLoading={isSwitchChainPending}
                  className="w-full"
                >
                  Switch to {nextChain.name}
                </Button>
                {isSwitchChainError && renderError(switchChainError)}
              </>
            )}
          </div>
        )}

        <Footer
          activeTab={currentTab as Tab}
          setActiveTab={setActiveTab}
          showWallet={USE_WALLET}
          onYoinkClick={handleYoinkClick}
        />
      </div>

      <YoinkDialog isOpen={isYoinkDialogOpen} onClose={() => setIsYoinkDialogOpen(false)} />
    </div>
  );
}

function NextStopTrigger() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    // @todo: pull `lastCastHash` from KV store
    const castHash = '0x09cb24bb'; // Hardcoded for testing

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/send-train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ castHash }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`Success! Winner: ${data.winner}`);
      } else {
        setResult(`Error: ${data.error || 'Failed to trigger next stop'}`);
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <Button onClick={handleSubmit} disabled={isLoading} isLoading={isLoading} className="w-full">
        Trigger Next Stop
      </Button>
      {result && (
        <div
          className={`text-xs p-2 rounded ${
            result.startsWith('Success')
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}
        >
          {result}
        </div>
      )}
    </div>
  );
}

function SignEvmMessage() {
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const {
    signMessage,
    data: signature,
    error: signError,
    isError: isSignError,
    isPending: isSignPending,
  } = useSignMessage();

  const handleSignMessage = useCallback(async () => {
    if (!isConnected) {
      await connectAsync({
        chainId: base.id,
        connector: config.connectors[0],
      });
    }

    signMessage({ message: `Hello from ${APP_NAME}!` });
  }, [connectAsync, isConnected, signMessage]);

  return (
    <>
      <Button onClick={handleSignMessage} disabled={isSignPending} isLoading={isSignPending}>
        Sign Message
      </Button>
      {isSignError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
}

function SendEth() {
  const { isConnected, chainId } = useAccount();
  const {
    sendTransaction,
    data,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: data,
  });

  const toAddr = useMemo(() => {
    // Protocol guild address
    return chainId === base.id
      ? '0x32e3C7fD24e175701A35c224f2238d18439C7dBC'
      : '0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830';
  }, [chainId]);

  const handleSend = useCallback(() => {
    sendTransaction({
      to: toAddr,
      value: 1n,
    });
  }, [toAddr, sendTransaction]);

  return (
    <>
      <Button
        onClick={handleSend}
        disabled={!isConnected || isSendTxPending}
        isLoading={isSendTxPending}
      >
        Send Transaction (eth)
      </Button>
      {isSendTxError && renderError(sendTxError)}
      {data && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(data)}</div>
          <div>
            Status: {isConfirming ? 'Confirming...' : isConfirmed ? 'Confirmed!' : 'Pending'}
          </div>
        </div>
      )}
    </>
  );
}

function SignIn() {
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signInResult, setSignInResult] = useState<SignInCore.SignInResult>();
  const [signInFailure, setSignInFailure] = useState<string>();
  const { data: session, status } = useSession();

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken();
    if (!nonce) throw new Error('Unable to generate nonce');
    return nonce;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      setSignInFailure(undefined);
      const nonce = await getNonce();
      const result = await sdk.actions.signIn({ nonce });
      setSignInResult(result);

      await signIn('credentials', {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure('Rejected by user');
        return;
      }

      setSignInFailure('Unknown error');
    } finally {
      setSigningIn(false);
    }
  }, [getNonce]);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      await signOut({ redirect: false });
      setSignInResult(undefined);
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <>
      {status !== 'authenticated' && (
        <Button onClick={handleSignIn} disabled={signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === 'authenticated' && (
        <Button onClick={handleSignOut} disabled={signingOut}>
          Sign out
        </Button>
      )}
      {session && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">Session</div>
          <div className="whitespace-pre">{JSON.stringify(session, null, 2)}</div>
        </div>
      )}
      {signInFailure && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">{signInFailure}</div>
        </div>
      )}
      {signInResult && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 mb-1">SIWF Result</div>
          <div className="whitespace-pre">{JSON.stringify(signInResult, null, 2)}</div>
        </div>
      )}
    </>
  );
}

const renderError = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof BaseError) {
    const isUserRejection = error.walk((e) => e instanceof UserRejectedRequestError);

    if (isUserRejection) {
      return <div className="text-red-500 text-xs mt-1">Rejected by user.</div>;
    }
  }

  return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
};
