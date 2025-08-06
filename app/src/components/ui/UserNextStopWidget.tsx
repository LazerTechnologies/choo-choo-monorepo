'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { UsernameInput } from '@/components/ui/UsernameInput';
import axios from 'axios';

interface UserNextStopWidgetProps {
  onTokenMinted?: () => void;
}

export function UserNextStopWidget({ onTokenMinted }: UserNextStopWidgetProps) {
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

  const handleSendChooChoo = useCallback(async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post('/api/user-send-train', {
        targetFid: selectedUser.fid,
      });

      if (res.data.success) {
        setResult(res.data);
        onTokenMinted?.();
      } else {
        setError(res.data.error || 'Failed to send ChooChoo');
      }
    } catch (err) {
      console.error('Error sending ChooChoo:', err);
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to send ChooChoo');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedUser, onTokenMinted]);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="text-center">
          <Typography variant="h4" className="text-gray-900 dark:text-gray-100 font-comic mb-2">
            Choose Next Passenger
          </Typography>
          <Typography variant="body" className="text-gray-600 dark:text-gray-300">
            You&apos;ve sent your announcement cast! You can now either wait for reactions and let a
            random winner be chosen, or manually choose the next passenger by entering their FID
            below.
          </Typography>
        </div>

        <div>
          <UsernameInput
            label="Select Next Passenger (Optional)"
            placeholder="Enter username..."
            onUserSelect={setSelectedUser}
            disabled={loading}
            helperText="Leave empty if you want to wait for reactions and let the community choose randomly."
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
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleSendChooChoo}
          disabled={loading || !selectedUser}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white"
        >
          {loading
            ? 'Sending ChooChoo...'
            : selectedUser
              ? `🚂 Send ChooChoo to @${selectedUser.username}`
              : 'Send ChooChoo'}
        </Button>

        {error && (
          <div className="text-xs text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs space-y-2 border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
            <div className="text-green-600 dark:text-green-400 font-semibold">
              ✅ ChooChoo Successfully Sent!
            </div>

            <div>
              <span className="font-semibold">New Passenger:</span>
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
              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded mt-1 break-all text-xs">
                {result.txHash}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
