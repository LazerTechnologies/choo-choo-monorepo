'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Input } from '@/components/base/Input';
import { Typography } from '@/components/base/Typography';
import axios from 'axios';

interface UserNextStopWidgetProps {
  onTokenMinted?: () => void;
}

export function UserNextStopWidget({ onTokenMinted }: UserNextStopWidgetProps) {
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

  const handleSendChooChoo = useCallback(async () => {
    const fidNumber = parseInt(fid.trim());
    if (!fid.trim() || isNaN(fidNumber) || fidNumber <= 0) {
      setError('Please enter a valid Farcaster FID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post('/api/user-send-train', {
        targetFid: fidNumber,
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
  }, [fid, onTokenMinted]);

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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Farcaster FID (Optional)
          </label>
          <Input
            type="number"
            placeholder="Enter FID to manually select next passenger"
            value={fid}
            onChange={(e) => setFid(e.target.value)}
            className="w-full"
            min="1"
            disabled={loading}
          />
          <div className="text-xs text-gray-500 mt-1">
            Leave empty if you want to wait for reactions and let the community choose randomly.
          </div>
        </div>

        <Button
          onClick={handleSendChooChoo}
          disabled={loading || !fid.trim()}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white"
        >
          {loading ? 'Sending ChooChoo...' : '🚂 Send ChooChoo to This User'}
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
