'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Input } from '@/components/base/Input';
import { Typography } from '@/components/base/Typography';
import { Switch } from '@/components/base/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/base/Select';
import { UsernameInput } from '@/components/ui/UsernameInput';
import { Textarea } from '@/components/base/Textarea';
import { CHOOCHOO_CAST_TEMPLATES, APP_URL } from '@/lib/constants';

import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useFrameContext } from '@/hooks/useFrameContext';
import { WorkflowState } from '@/lib/workflow-types';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import type { PinataUploadResult } from '@/types/nft';
import axios from 'axios';

interface AdminPageProps {
  onTokenMinted?: () => void;
}

function AppStateTesting({
  adminFid,
  disabled = false,
}: {
  adminFid?: number;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  const testStates = useMemo(
    () => [
      {
        id: 'not-casted',
        name: 'Not Casted (Initial State)',
        description: 'Current holder has not sent announcement cast yet',
        workflowData: {
          state: WorkflowState.NOT_CASTED,
          winnerSelectionStart: null,
          currentCastHash: null,
        },
      },
      {
        id: 'casted',
        name: 'Casted (Selection Mode)',
        description: 'Current holder has casted, can choose manual or chance mode',
        workflowData: {
          state: WorkflowState.CASTED,
          winnerSelectionStart: null,
          currentCastHash: null,
        },
      },
      {
        id: 'chance-active',
        name: 'Chance Mode - Active Countdown',
        description: '30min countdown active, public sending disabled',
        workflowData: {
          state: WorkflowState.CHANCE_ACTIVE,
          winnerSelectionStart: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          currentCastHash: '0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7',
        },
      },
      {
        id: 'chance-expired',
        name: 'Chance Mode - Timer Expired',
        description: 'Timer expired, public sending enabled',
        workflowData: {
          state: WorkflowState.CHANCE_EXPIRED,
          winnerSelectionStart: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          currentCastHash: '0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7',
        },
      },
      {
        id: 'manual-send',
        name: 'Manual Send Mode',
        description: 'Train is currently being sent manually',
        workflowData: {
          state: WorkflowState.MANUAL_SEND,
          winnerSelectionStart: null,
          currentCastHash: null,
        },
      },
    ],
    [],
  );

  const handleSetState = useCallback(async () => {
    if (!adminFid) {
      setError('You must be signed in to use admin functions');
      return;
    }

    if (!selectedStateId) {
      setError('Please select a state');
      return;
    }

    const state = testStates.find((s) => s.id === selectedStateId);
    if (!state) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('/api/workflow-state', state.workflowData);

      if (response.status === 200) {
        setResult(`Successfully set workflow state: ${state.name}`);

        try {
          window.dispatchEvent(
            new CustomEvent('workflow-state-changed', {
              detail: state.workflowData,
            }),
          );
        } catch {}

        setTimeout(() => setResult(null), 3000);
      } else {
        throw new Error('Workflow state API returned error');
      }
    } catch (err) {
      console.error('Error setting workflow state:', err);
      setError(`Failed to set workflow state: ${state.name}`);
    } finally {
      setLoading(false);
    }
  }, [adminFid, selectedStateId, testStates]);

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-blue-600 !border-white">
      <Card.Header>
        <Card.Title>App State Test</Card.Title>
        <Card.Description>
          Switch between app states to test the flow without going through normal user actions. Each
          option sets the state and UI.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-4">
          <div className="text-xs text-gray-400 p-2 bg-blue-800/30 rounded">
            <div className="font-semibold mb-2">States:</div>
            <div className="space-y-1">
              <div>
                • <strong>NOT_CASTED:</strong> Current holder hasn&apos;t sent announcement cast
              </div>
              <div>
                • <strong>CASTED:</strong> Current holder chooses mode
              </div>
              <div>
                • <strong>CHANCE_ACTIVE:</strong> 30min countdown active
              </div>
              <div>
                • <strong>CHANCE_EXPIRED:</strong> Public random send enabled
              </div>
              <div>
                • <strong>MANUAL_SEND:</strong> Manual sending in progress
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Select value={selectedStateId} onValueChange={setSelectedStateId}>
              <SelectTrigger className="w-full !bg-white !text-black border-gray-300 focus:border-blue-500">
                <SelectValue placeholder="Select a state to test..." />
              </SelectTrigger>
              <SelectContent>
                {testStates.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSetState}
              disabled={loading || !selectedStateId || !adminFid}
              isLoading={loading}
              className="w-full bg-blue-600 text-white border-white hover:bg-blue-700"
              variant="default"
            >
              Set
            </Button>
          </div>

          {error && (
            <div className="text-xs text-red-300 mt-3 p-2 bg-red-900/20 rounded">{error}</div>
          )}

          {result && (
            <div className="text-xs text-green-300 mt-3 p-2 bg-green-900/20 rounded">{result}</div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

function AdminGenerate({ adminFid, disabled = false }: { adminFid?: number; disabled?: boolean }) {
  const [result, setResult] = useState<(PinataUploadResult & { message?: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateNFT() {
    if (!adminFid) {
      setError('Admin access required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/generate/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Error generating NFT:', err);
      setError('Generation failed');
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-blue-600 !border-white">
      <Card.Header>
        <Card.Title>Generate tokenURI</Card.Title>
        <Card.Description>
          Generate a random NFT & metadata using the generator package and upload to Pinata.
          <br />
          In the event a token needs to be updated manually.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <Button
            onClick={handleGenerateNFT}
            disabled={loading || !adminFid}
            isLoading={loading}
            className="w-full bg-blue-600 text-white border-white hover:bg-blue-700"
            variant="default"
          >
            Generate
          </Button>

          {loading && (
            <div className="text-xs text-gray-300 p-2 bg-purple-700/50 rounded">Generating...</div>
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
                <pre className="bg-purple-600/50 p-2 rounded text-xs overflow-x-auto text-gray-300">
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
  disabled = false,
}: {
  onTokenMinted?: () => void;
  adminFid?: number;
  disabled?: boolean;
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
  const { getFrameData } = useFrameContext();
  const [holderStatus, setHolderStatus] = useState<{
    hasCurrentHolder: boolean;
    canSetInitialHolder: boolean;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHolderStatus() {
      try {
        setIsLoadingStatus(true);
        setStatusError(null);
        const response = await fetch('/api/admin/holder-status', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to check holder status');
        }
        const data = await response.json();
        setHolderStatus(data);
      } catch (err) {
        console.error('Error checking holder status:', err);
        setStatusError('Failed to check status');
      } finally {
        setIsLoadingStatus(false);
      }
    }

    checkHolderStatus();
  }, [getFrameData]);

  const isDisabled = holderStatus ? !holderStatus.canSetInitialHolder : false;
  const hasCurrentHolder = holderStatus ? holderStatus.hasCurrentHolder : false;

  const handleSetInitialHolder = useCallback(async () => {
    if (isDisabled) {
      setError('Cannot set initial holder: A current holder already exists');
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
      const res = await fetch('/api/admin/initial-holder/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetFid: selectedUser.fid,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data.holder);
        onTokenMinted?.(); // Trigger refresh of current holder display
        const statusResponse = await fetch('/api/admin/holder-status', {
          method: 'GET',
          credentials: 'include',
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setHolderStatus(statusData);
        }
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

  if (disabled) {
    return null;
  }

  return (
    <Card className={`my-8 w-full !border-white ${isDisabled ? '!bg-gray-400' : '!bg-purple-600'}`}>
      <Card.Header>
        <Card.Title>Set Initial Holder</Card.Title>
        <Card.Description>
          Set the initial holder on contract deployment. This populates the current-holder key so
          the app knows who is holding tokenId: 0 and the rest of the flow works properly.
          {hasCurrentHolder && (
            <div className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
              ⚠️ DISABLED: A current holder already exists.
            </div>
          )}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <UsernameInput
              label="Select Initial Holder"
              placeholder="Search username..."
              onUserSelect={setSelectedUser}
              disabled={isDisabled || isLoadingStatus}
              helperText=""
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
            disabled={loading || !selectedUser || isDisabled || isLoadingStatus}
            isLoading={loading || isLoadingStatus}
            className={`w-full text-white border-white ${
              isDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
            variant="default"
          >
            {selectedUser
              ? `Set @${selectedUser.username} as Initial Holder`
              : 'Set Initial Holder'}
          </Button>
        </div>

        {(error || statusError) && (
          <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error || statusError}
          </div>
        )}

        {isLoadingStatus && (
          <div className="text-xs text-blue-600 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
            Checking status...
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

function SetTicketMetadata({
  adminFid,
  disabled = false,
}: {
  adminFid?: number;
  disabled?: boolean;
}) {
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
    const tokenIdNumber = Number.parseInt(tokenId.trim());
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

      const res = await fetch('/api/admin/set-ticket-data/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenId: tokenIdNumber,
          tokenURI,
          image: '',
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
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

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-blue-600 !border-white">
      <Card.Header>
        <Card.Title>Set Token Metadata</Card.Title>
        <Card.Description>
          Update metadata for any ticket NFT. The metadata should contain the complete JSON as
          produced by the generator.
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
            <div className="text-xs text-gray-200 mt-1">TokenId &gt; 0</div>
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
            <div className="text-xs text-gray-200 mt-1">
              IPFS hash of the complete metadata JSON (with or without ipfs:// prefix)
            </div>
          </div>

          <Button
            onClick={handleSetTicketMetadata}
            disabled={loading || !tokenId.trim() || !metadataHash.trim()}
            isLoading={loading}
            className="w-full bg-blue-600 text-white border-white hover:bg-blue-700"
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
  disabled = false,
}: {
  onTokenMinted?: () => void;
  adminFid?: number;
  disabled?: boolean;
}) {
  const { refetch: refreshWorkflowState } = useWorkflowState();
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
      const res = await fetch('/api/admin/send-train/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetFid: selectedUser.fid,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data);
        void refreshWorkflowState();
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
  }, [selectedUser, adminFid, onTokenMinted, refreshWorkflowState]);

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Manually Send ChooChoo</Card.Title>
        <Card.Description>
          Send ChooChoo to any user. This will fetch their primary wallet address, generate a unique
          NFT, and mint it to their wallet while bypassing the normal workflow.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <UsernameInput
              label="Select User to Receive ChooChoo"
              placeholder="Search username..."
              onUserSelect={setSelectedUser}
              disabled={loading}
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

function AppPauseToggle({ adminFid, disabled = false }: { adminFid?: number; disabled?: boolean }) {
  const [isPaused, setIsPaused] = useState(false);
  const [pendingState, setPendingState] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current pause state once on mount
  useEffect(() => {
    async function fetchPauseState() {
      try {
        setIsLoadingStatus(true);
        setError(null);
        const response = await fetch('/api/admin/app-pause', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch pause state');
        }
        const data = await response.json();
        setIsPaused(data.isPaused);
      } catch (err) {
        console.error('Error fetching pause state:', err);
        setError('Failed to load pause state');
      } finally {
        setIsLoadingStatus(false);
      }
    }

    fetchPauseState();
  }, []);

  const handleSwitchToggle = useCallback(
    (checked: boolean) => {
      if (!adminFid) {
        setError('You must be signed in to use admin functions');
        return;
      }
      setPendingState(checked);
      setError(null);
    },
    [adminFid],
  );

  const handleConfirmChange = useCallback(async () => {
    if (!adminFid || pendingState === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/app-pause/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isPaused: pendingState,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsPaused(pendingState);
        setPendingState(null);
      } else {
        setError(data.error || 'Failed to update pause state');
      }
    } catch (err) {
      console.error('Error updating pause state:', err);
      setError('Failed to update pause state');
    } finally {
      setLoading(false);
    }
  }, [adminFid, pendingState]);

  const handleCancelChange = useCallback(() => {
    setPendingState(null);
    setError(null);
  }, []);

  const currentDisplayState = pendingState !== null ? pendingState : isPaused;

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-red-100 !border-red-300 dark:!bg-red-900/20 dark:!border-red-700">
      <Card.Header>
        <Card.Title className="text-red-800 dark:text-red-300">Maintenance Mode</Card.Title>
        <Card.Description className="text-red-700 dark:text-red-400">
          Toggle this to pause the app for maintenance. When enabled, users will see a maintenance
          card on the home and yoink pages. The footer stays active so users can navigate to other
          pages.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium text-white">
                App is{' '}
                <span
                  className={
                    currentDisplayState ? 'text-red-500 font-bold' : 'text-green-500 font-bold'
                  }
                >
                  {currentDisplayState ? 'PAUSED' : 'ACTIVE'}
                </span>
              </label>
              <div className="text-xs text-blue-400">
                {currentDisplayState
                  ? 'Users will see maintenance cards on home and yoink pages'
                  : 'App is running normally'}
              </div>
            </div>
            <Switch
              checked={currentDisplayState}
              onCheckedChange={handleSwitchToggle}
              disabled={loading || isLoadingStatus || !adminFid}
              className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-purple-400"
            />
          </div>

          {pendingState !== null && (
            <div className="space-y-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <div className="text-sm font-medium text-red-800 dark:text-red-300">
                {pendingState ? '⚠️ Confirm App Pause' : '✅ Confirm App Resume'}
              </div>
              <div className="text-xs text-red-700 dark:text-red-400">
                {pendingState
                  ? 'This will pause the app for all users. Are you sure?'
                  : 'This will resume normal app operation. Are you sure?'}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmChange}
                  disabled={loading}
                  isLoading={loading}
                  size="sm"
                  className={`${pendingState ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                >
                  {pendingState ? 'Pause App' : 'Resume App'}
                </Button>
                <Button
                  onClick={handleCancelChange}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoadingStatus && (
            <div className="text-xs text-purple-600 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
              Loading pause state...
            </div>
          )}

          {loading && !pendingState && (
            <div className="text-xs text-purple-600 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
              Updating...
            </div>
          )}

          {error && (
            <div className="text-xs text-red-700 p-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {isPaused && pendingState === null && (
            <div className="text-xs text-red-800 dark:text-red-200 p-2 bg-red-200 dark:bg-red-900/40 rounded font-medium">
              🚨 The app is currently in maintenance mode!
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

function JourneyAnnouncement({
  adminFid,
  disabled = false,
}: {
  adminFid?: number;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!adminFid) {
      setError('You must be signed in to use admin functions');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const text = CHOOCHOO_CAST_TEMPLATES.JOURNEY_CONTINUES();
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/admin/send-cast/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text,
          embeds: [{ url: APP_URL }],
          idem: `journey-continues-${today}`,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(`Sent journey announcement${data.cast?.hash ? ` (${data.cast.hash})` : ''}`);
      } else {
        setError(data.error || 'Failed to send journey announcement');
      }
    } catch (err) {
      console.error('Error sending journey announcement:', err);
      setError('Failed to send journey announcement');
    } finally {
      setLoading(false);
    }
  }, [adminFid]);

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Send Journey Announcement</Card.Title>
        <Card.Description>
          Posts the prewritten <span className="font-bold text-blue-200">JOURNEY_CONTINUES</span>{' '}
          message from @choochoo.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <Button
            onClick={handleSend}
            disabled={loading || !adminFid}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            Send Announcement
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded">
            ✅ {result}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

function CustomCast({ adminFid, disabled = false }: { adminFid?: number; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!adminFid) {
      setError('You must be signed in to use admin functions');
      return;
    }
    if (!text.trim()) {
      setError('Please enter a message');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/send-cast/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(`Cast sent${data.cast?.hash ? ` (${data.cast.hash})` : ''}`);
        setText('');
      } else {
        setError(data.error || 'Failed to send cast');
      }
    } catch (err) {
      console.error('Error sending custom cast:', err);
      setError('Failed to send cast');
    } finally {
      setLoading(false);
    }
  }, [adminFid, text]);

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-purple-600 !border-white">
      <Card.Header>
        <Card.Title>Send Custom Cast</Card.Title>
        <Card.Description>Write and send a custom cast from @choochoo.</Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <Textarea
            placeholder="Type your announcement..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="!bg-white !text-black border-gray-300"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !adminFid || !text.trim()}
            isLoading={loading}
            className="w-full bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            Send Cast
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-500 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded">
            ✅ {result}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

function RedisRepair({ adminFid, disabled = false }: { adminFid?: number; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    onChainTotalTickets: number;
    redisCurrentTokenId: number | null;
    tokensChecked: number;
    tokensRepaired: number;
    tokensWithMissingData: number[];
    tokensWithIncorrectData: number[];
    trackerRepaired: boolean;
    errors: string[];
    dryRun?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRepair = async (dryRun: boolean) => {
    if (!adminFid) {
      setError('You must be signed in to use admin functions');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch('/api/admin/repair-redis/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun,
          miniAppContext: {
            userFid: adminFid,
            isAuthenticated: true,
            hasContext: true,
          },
          fid: adminFid,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Repair failed');
      }

      setReport(data.report);
    } catch (err) {
      console.error('Repair error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (disabled) {
    return null;
  }

  return (
    <Card className="my-8 w-full !bg-orange-100 !border-orange-300 dark:!bg-orange-900/20 dark:!border-orange-700">
      <Card.Header>
        <Card.Title className="text-orange-800 dark:text-orange-300">Redis Repair</Card.Title>
        <Card.Description className="text-orange-700 dark:text-orange-400">
          Sync Redis cache with on-chain token data. Use dry run first to see what would be changed.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => runRepair(true)}
              disabled={loading || !adminFid}
              variant="outline"
              className="flex-1"
            >
              {loading ? 'Running...' : 'Dry Run'}
            </Button>
            <Button
              onClick={() => runRepair(false)}
              disabled={loading || !adminFid}
              className="flex-1 !bg-orange-600 hover:!bg-orange-700"
            >
              {loading ? 'Running...' : 'Run Repair'}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-md">
              <Typography variant="small" className="text-red-800">
                ❌ {error}
              </Typography>
            </div>
          )}

          {report && (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-md">
              <Typography variant="small" className="text-blue-800 font-semibold mb-2">
                📋 Repair Report {report.dryRun && '(Dry Run)'}
              </Typography>
              <div className="text-xs text-blue-700 space-y-1">
                <div>On-chain total tickets: {report.onChainTotalTickets}</div>
                <div>Redis current token ID: {report.redisCurrentTokenId}</div>
                <div>Tokens checked: {report.tokensChecked}</div>
                <div>Tokens repaired: {report.tokensRepaired}</div>
                <div>Missing tokens: {report.tokensWithMissingData.length}</div>
                <div>Incorrect tokens: {report.tokensWithIncorrectData.length}</div>
                <div>Tracker repaired: {report.trackerRepaired ? 'Yes' : 'No'}</div>
                {report.errors.length > 0 && (
                  <div className="text-red-600">Errors: {report.errors.length}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export function AdminPage({ onTokenMinted }: AdminPageProps) {
  const { isAdmin, currentUserFid } = useAdminAccess();

  /**
   * @description flag to show/hide cards
   * set `true` to show a card, `false` to hide it
   */
  const SHOW_CARD = {
    setInitialHolder: false,
    journeyAnnouncement: true,
    customCast: true,
    adminGenerate: false,
    setTicketMetadata: true,
    testAdminNextStop: true,
    redisRepair: false,
    appPauseToggle: true,
    appStateTesting: false,
  };

  if (!isAdmin) {
    return (
      <div className="space-y-3 px-6 w-full max-w-md mx-auto">
        <div className="flex justify-center items-center min-h-[300px]">
          <Card
            className="p-6 !bg-purple-600 !text-white !border-white"
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
      {/* Admin Actions */}
      <SetInitialHolder
        onTokenMinted={onTokenMinted}
        adminFid={currentUserFid}
        disabled={!SHOW_CARD.setInitialHolder}
      />
      <JourneyAnnouncement adminFid={currentUserFid} disabled={!SHOW_CARD.journeyAnnouncement} />
      <CustomCast adminFid={currentUserFid} disabled={!SHOW_CARD.customCast} />
      <AdminGenerate adminFid={currentUserFid} disabled={!SHOW_CARD.adminGenerate} />
      <SetTicketMetadata adminFid={currentUserFid} disabled={!SHOW_CARD.setTicketMetadata} />
      <TestAdminNextStop
        onTokenMinted={onTokenMinted}
        adminFid={currentUserFid}
        disabled={!SHOW_CARD.testAdminNextStop}
      />
      <RedisRepair adminFid={currentUserFid} disabled={!SHOW_CARD.redisRepair} />
      <AppPauseToggle adminFid={currentUserFid} disabled={!SHOW_CARD.appPauseToggle} />
      {/* App State Testing */}
      {/* @todo: remove this when we go live */}
      <AppStateTesting adminFid={currentUserFid} disabled={!SHOW_CARD.appStateTesting} />
    </div>
  );
}
