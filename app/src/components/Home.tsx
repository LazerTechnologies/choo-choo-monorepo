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
import { CastingWidget } from '@/components/ui/CastingWidget';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useNeynarContext } from '@neynar/react';
import { useSoundPlayer } from '@/hooks/useSoundPlayer';
import { Typography } from '@/components/base/Typography';
import { USE_WALLET, APP_NAME } from '@/lib/constants';
import Image from 'next/image';
import type { PinataUploadResult } from '@/types/nft';

export type Tab = 'home' | 'actions' | 'wallet';

interface NeynarUser {
  fid: number;
  score: number;
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
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Test Pinata (Generator)</Card.Title>
        <Card.Description>
          Generate a new NFT using the generator package and upload to Pinata for testing purposes.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <Button
            onClick={handleUploadToPinata}
            disabled={loading}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            Generate & Upload NFT
          </Button>

          {loading && (
            <div className="text-xs text-gray-300 p-2 bg-purple-700/50 rounded">Uploading...</div>
          )}

          {error && <div className="text-xs text-red-300 p-2 bg-red-900/20 rounded">{error}</div>}
        </div>

        {result && (
          <div className="text-xs space-y-2 border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div className="text-green-300 font-semibold">✅ {result.message}</div>

            <div className="border-t border-gray-400 pt-2">
              <div className="font-semibold mb-1 text-gray-200">Image:</div>
              <div className="text-gray-300">
                Hash: <span className="font-mono">{result.imageHash}</span>
              </div>
              {result.imageUrl && (
                <div className="text-gray-300">
                  URL:{' '}
                  <a
                    href={result.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 hover:underline font-mono text-xs break-all"
                  >
                    {result.imageUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-gray-400 pt-2">
              <div className="font-semibold mb-1 text-gray-200">Metadata:</div>
              <div className="text-gray-300">
                Hash: <span className="font-mono">{result.metadataHash}</span>
              </div>
              {result.metadataUrl && (
                <div className="text-gray-300">
                  URL:{' '}
                  <a
                    href={result.metadataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 hover:underline font-mono text-xs break-all"
                  >
                    {result.metadataUrl}
                  </a>
                </div>
              )}
              {result.tokenURI && (
                <div className="text-gray-300">
                  Token URI: <span className="font-mono">{result.tokenURI}</span>
                </div>
              )}
            </div>

            {result.metadata && (
              <div className="border-t border-gray-400 pt-2">
                <div className="font-semibold mb-1 text-gray-200">Uploaded Metadata:</div>
                <pre className="bg-purple-800/50 p-2 rounded text-xs overflow-x-auto text-gray-300">
                  {JSON.stringify(result.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

function TestAdminNextStop({
  onTokenMinted,
  adminFid,
}: {
  onTokenMinted?: () => void;
  adminFid?: number;
}) {
  const [fid, setFid] = useState('');
  const [result, setResult] = useState<{
    winner: {
      address: string;
      username: string;
      fid: number;
      displayName: string;
      pfpUrl: string;
    };
    tokenId: number;
    txHash: string;
    tokenURI: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteNextStop = useCallback(async () => {
    const fidNumber = parseInt(fid.trim());
    if (!fid.trim() || isNaN(fidNumber) || fidNumber <= 0) {
      setError('Please enter a valid Farcaster FID (positive number)');
      return;
    }

    // Check if admin FID is available
    if (!adminFid) {
      setError('You must be signed in to use admin functions');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin-send-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFid: fidNumber,
          adminFid: adminFid,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data);
        onTokenMinted?.();
      } else {
        setError(data.error || 'Failed to execute admin nextStop');
      }
    } catch (e) {
      setError('Failed to execute admin nextStop');
    } finally {
      setLoading(false);
    }
  }, [fid, adminFid, onTokenMinted]);

  return (
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Admin ChooChoo NextStop</Card.Title>
        <Card.Description>
          Send ChooChoo to any Farcaster user by entering their FID. This will automatically fetch
          their verified wallet address, generate a unique NFT, and mint it to their wallet.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Farcaster FID
            </label>
            <Input
              type="number"
              placeholder="377557"
              value={fid}
              onChange={(e) => setFid(e.target.value)}
              className="w-full !bg-white !text-black border-gray-300 focus:border-purple-500"
              min="1"
            />
            <div className="text-xs text-gray-500 mt-1">
              Enter the Farcaster ID (FID) of the user who should receive ChooChoo next.
            </div>
          </div>

          <Button
            onClick={handleExecuteNextStop}
            disabled={loading || !fid.trim()}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            🚂 Send ChooChoo to User
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
              ✅ ChooChoo Successfully Sent!
            </div>

            <div>
              <span className="font-semibold">Winner:</span>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                <div>
                  <strong>Username:</strong> @{result.winner.username}
                </div>
                <div>
                  <strong>Display Name:</strong> {result.winner.displayName}
                </div>
                <div>
                  <strong>FID:</strong> {result.winner.fid}
                </div>
                <div>
                  <strong>Address:</strong>{' '}
                  <code className="text-xs break-all">{result.winner.address}</code>
                </div>
              </div>
            </div>

            <div>
              <span className="font-semibold">Token ID:</span>{' '}
              <code className="text-xs">#{result.tokenId}</code>
            </div>

            <div>
              <span className="font-semibold">Transaction Hash:</span>
              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded mt-1 break-all">
                {result.txHash}
              </div>
            </div>

            <div>
              <span className="font-semibold">Token URI:</span>{' '}
              <code className="text-xs break-all">{result.tokenURI}</code>
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
  const { isCurrentHolder, loading: isHolderLoading } = useCurrentHolder();
  const { user: neynarAuthUser } = useNeynarContext();

  // Admin FIDs - only these users can access the admin tab
  const adminFids = [377557, 2802, 243300];
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
  const isAdmin = currentUserFid ? adminFids.includes(currentUserFid) : false;
  const { playChooChoo } = useSoundPlayer();
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
              <Typography variant="h1" className="text-center mb-4 text-white font-comic text-4xl">
                {APP_NAME}
              </Typography>
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
                ChooChoo is trying to visit every wallet on Base! When ChooChoo is in your wallet,
                send out a cast below to help determine his next stop. Anyone who replies to that
                cast will be in the running to receive ChooChoo next.
              </p>
              <Button
                variant="link"
                onClick={() => playChooChoo({ volume: 0.7 })}
                className="mt-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                🚂 All aboard!
              </Button>
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

            {/* Casting Widget - Only show if user is signed in and is current holder */}
            {context?.user && !isHolderLoading && isCurrentHolder && (
              <div className="w-full max-w-md mx-auto mb-8 flex flex-col items-center justify-center">
                <Typography
                  variant="h3"
                  className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
                >
                  Pick Next Passenger
                </Typography>
                <Typography
                  variant="body"
                  className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
                >
                  You&apos;re the current passenger! Send out a cast to let everyone know that
                  ChooChoo is about to be on the move. Once people start reacting, you&apos;ll be
                  able to randomly select a winner and send ChooChoo to their wallet.
                </Typography>
                <div className="w-full flex justify-center">
                  <CastingWidget />
                </div>
              </div>
            )}

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
                <p className="text-sm text-white dark:text-white">
                  Built on Base 🔵 | Powered by Neynar 🪐 | Only on Farcaster 💜
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'actions' && (
          <div className="space-y-3 px-6 w-full max-w-md mx-auto">
            {isAdmin ? (
              <>
                {/* Admin Test Sections */}
                <TestPinata />
                <TestAdminNextStop
                  onTokenMinted={() => setTimelineRefreshTrigger((prev) => prev + 1)}
                  adminFid={currentUserFid}
                />
              </>
            ) : (
              <div className="flex justify-center items-center min-h-[300px]">
                <Card
                  className="p-6 !bg-purple-500 !text-white !border-white"
                  style={{ backgroundColor: '#a855f7' }}
                >
                  <Typography variant="h4" className="text-center !text-white mb-2">
                    Admin Dashboard
                  </Typography>
                </Card>
              </div>
            )}
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
