'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Input } from '@/components/base/Input';
import { Typography } from '@/components/base/Typography';
import { UsernameInput } from '@/components/ui/UsernameInput';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useChooChoo } from '@/hooks/useChooChoo';
import type { PinataUploadResult } from '@/types/nft';

interface AdminPageProps {
  onTokenMinted?: () => void;
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
    } catch (err) {
      console.error('Error uploading to Pinata:', err);
      setError('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Generate tokenURI</Card.Title>
        <Card.Description>
          Generate a random NFT image using the generator package along with it&apos;s accompanying
          metadata and upload to Pinata in the event a token needs to be manually updated.
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
            Generate
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

function SetInitialHolder({
  onTokenMinted,
  adminFid,
}: {
  onTokenMinted?: () => void;
  adminFid?: number;
}) {
  const [selectedUser, setSelectedUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null>(null);
  const [result, setResult] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    address: string;
    timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { useTotalSupply } = useChooChoo();
  const { data: totalSupply, isLoading: isLoadingSupply, error: supplyError } = useTotalSupply();

  const isDisabled = totalSupply !== undefined && Number(totalSupply) > 1;
  const hasJourneyTickets = totalSupply !== undefined && Number(totalSupply) > 1;

  const handleSetInitialHolder = useCallback(async () => {
    if (isDisabled) {
      setError('Cannot set initial holder: Journey tickets have already been minted');
      return;
    }

    if (!selectedUser) {
      setError('Please select a user');
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
      const res = await fetch('/api/admin-set-initial-holder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFid: selectedUser.fid,
          adminFid: adminFid,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data.holder);
        onTokenMinted?.(); // Trigger refresh of current holder display
      } else {
        setError(data.error || 'Failed to set initial holder');
      }
    } catch (err) {
      console.error('Error setting initial holder:', err);
      setError('Failed to set initial holder');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, adminFid, onTokenMinted, isDisabled]);

  return (
    <Card className={`my-8 !border-white ${isDisabled ? '!bg-gray-400' : '!bg-purple-800'}`}>
      <Card.Header>
        <Card.Title>Set Initial Holder</Card.Title>
        <Card.Description>
          Set the initial current holder in Redis for fresh mainnet deployment. This populates the
          current-holder key so the app knows who is holding tokenId: 0 and the rest of the flow
          works properly.
          {hasJourneyTickets && (
            <div className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
              ⚠️ DISABLED: {Number(totalSupply) - 1} journey ticket(s) have been minted. This
              function is only for fresh deployments.
            </div>
          )}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <UsernameInput
              label="Select Initial Holder"
              placeholder="Search for a user by username..."
              onUserSelect={setSelectedUser}
              disabled={isDisabled || isLoadingSupply}
              helperText="Enter the user who should be the initial current holder."
              className="w-full"
            />
            {selectedUser && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border">
                <div className="flex items-center gap-2">
                  <Image
                    src={selectedUser.pfpUrl}
                    alt={`${selectedUser.username} avatar`}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">@{selectedUser.username}</span>
                  <span className="text-xs text-gray-500">({selectedUser.displayName})</span>
                  <span className="text-xs text-gray-400 ml-auto">FID: {selectedUser.fid}</span>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSetInitialHolder}
            disabled={loading || !selectedUser || isDisabled || isLoadingSupply}
            isLoading={loading || isLoadingSupply}
            className={`w-full text-white border-white ${
              isDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-800 hover:bg-purple-900'
            }`}
            variant="default"
          >
            {selectedUser
              ? `Set @${selectedUser.username} as Initial Holder`
              : 'Set Initial Holder'}
          </Button>
        </div>

        {(error || supplyError) && (
          <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error || 'Failed to check contract state'}
          </div>
        )}

        {isLoadingSupply && !hasJourneyTickets && (
          <div className="text-xs text-blue-600 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
            Checking...
          </div>
        )}

        {result && (
          <div className="text-xs space-y-2 border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div className="text-green-600 dark:text-green-400 font-semibold">
              ✅ Initial Holder Set Successfully!
            </div>

            <div>
              <span className="font-semibold">Initial Holder:</span>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                <div>
                  <strong>Username:</strong> @{result.username}
                </div>
                <div>
                  <strong>Display Name:</strong> {result.displayName}
                </div>
                <div>
                  <strong>FID:</strong> {result.fid}
                </div>
                <div>
                  <strong>Address:</strong>{' '}
                  <code className="text-xs break-all">{result.address}</code>
                </div>
                <div>
                  <strong>Timestamp:</strong>{' '}
                  <code className="text-xs">{new Date(result.timestamp).toLocaleString()}</code>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

function SetTicketMetadata({ adminFid }: { adminFid?: number }) {
  const [tokenId, setTokenId] = useState('');
  const [metadataHash, setMetadataHash] = useState('');
  const [result, setResult] = useState<{
    success: boolean;
    tokenId: number;
    finalTokenURI?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetTicketMetadata = useCallback(async () => {
    const tokenIdNumber = parseInt(tokenId.trim());
    if (!tokenId.trim() || isNaN(tokenIdNumber) || tokenIdNumber <= 0) {
      setError('Please enter a valid Token ID');
      return;
    }

    if (!metadataHash.trim()) {
      setError('Please enter a metadata hash');
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
      // Format the metadata hash - add ipfs:// prefix if just a hash
      const trimmedHash = metadataHash.trim();
      const tokenURI = trimmedHash.startsWith('ipfs://') ? trimmedHash : `ipfs://${trimmedHash}`;

      const res = await fetch('/api/admin-set-ticket-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: tokenIdNumber,
          tokenURI,
          image: '', // Empty since metadata contains everything
          traits: '', // Empty since metadata contains everything
          adminFid: adminFid,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ ...data, finalTokenURI: tokenURI });
      } else {
        setError(data.error || 'Failed to set ticket metadata');
      }
    } catch (err) {
      console.error('Error setting ticket metadata:', err);
      setError('Failed to set ticket metadata');
    } finally {
      setLoading(false);
    }
  }, [tokenId, metadataHash, adminFid]);

  return (
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Set Token Metadata</Card.Title>
        <Card.Description>
          Update or set metadata for any ticket NFT. The metadata hash should contain the complete
          JSON with image, traits, and all other properties generated by the NFT generator.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token ID
            </label>
            <Input
              type="number"
              placeholder="1"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full !bg-white !text-black border-gray-300 focus:border-purple-500"
              min="1"
            />
            <div className="text-xs text-gray-500 mt-1">
              The ticket token ID to update (cannot be 0 - that&apos;s the train)
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metadata Hash
            </label>
            <Input
              type="text"
              placeholder="QmYourMetadataHash..."
              value={metadataHash}
              onChange={(e) => setMetadataHash(e.target.value)}
              className="w-full !bg-white !text-black border-gray-300 focus:border-purple-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              IPFS hash of the complete metadata JSON (with or without ipfs:// prefix)
            </div>
          </div>

          <Button
            onClick={handleSetTicketMetadata}
            disabled={loading || !tokenId.trim() || !metadataHash.trim()}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            Set tokenURI
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
              ✅ Token Metadata Set Successfully!
            </div>

            <div>
              <span className="font-semibold">Token ID:</span>{' '}
              <code className="text-xs">#{result.tokenId}</code>
            </div>

            <div>
              <span className="font-semibold">Metadata URI:</span>{' '}
              <code className="text-xs break-all">
                {result.finalTokenURI || `ipfs://${metadataHash.replace('ipfs://', '')}`}
              </code>
            </div>

            <div>
              <span className="font-semibold">Input Hash:</span>{' '}
              <code className="text-xs break-all">{metadataHash}</code>
            </div>
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
  const [selectedUser, setSelectedUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null>(null);
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
    if (!selectedUser) {
      setError('Please select a user');
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
          targetFid: selectedUser.fid,
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
    } catch (err) {
      console.error('Error executing admin nextStop:', err);
      setError('Failed to execute admin nextStop');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, adminFid, onTokenMinted]);

  return (
    <Card className="my-8 !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Send ChooChoo to User</Card.Title>
        <Card.Description>
          Send ChooChoo to any Farcaster user by entering their FID. This will automatically fetch
          their verified wallet address, generate a unique NFT, and mint it to their wallet.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <UsernameInput
              label="Select User to Receive ChooChoo"
              placeholder="Search for a user by username..."
              onUserSelect={setSelectedUser}
              disabled={loading}
              helperText="Enter the user who should receive ChooChoo next."
              className="w-full"
            />
            {selectedUser && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border">
                <div className="flex items-center gap-2">
                  <Image
                    src={selectedUser.pfpUrl}
                    alt={`${selectedUser.username} avatar`}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">@{selectedUser.username}</span>
                  <span className="text-xs text-gray-500">({selectedUser.displayName})</span>
                  <span className="text-xs text-gray-400 ml-auto">FID: {selectedUser.fid}</span>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleExecuteNextStop}
            disabled={loading || !selectedUser}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            {selectedUser ? `Send ChooChoo to @${selectedUser.username}` : 'Send ChooChoo'}
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

export function AdminPage({ onTokenMinted }: AdminPageProps) {
  const { isAdmin, currentUserFid } = useAdminAccess();

  if (!isAdmin) {
    return (
      <div className="space-y-3 px-6 w-full max-w-md mx-auto">
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
      </div>
    );
  }

  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      {/* Admin Test Sections */}
      <SetInitialHolder onTokenMinted={onTokenMinted} adminFid={currentUserFid} />
      <TestPinata />
      <SetTicketMetadata adminFid={currentUserFid} />
      <TestAdminNextStop onTokenMinted={onTokenMinted} adminFid={currentUserFid} />
    </div>
  );
}
