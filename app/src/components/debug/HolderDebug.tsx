'use client';

import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';

export function HolderDebug() {
  const { user: neynarUser } = useNeynarContext();
  const { context } = useMiniApp();
  const { currentHolder, isCurrentHolder, loading, error } = useCurrentHolder();

  return (
    <Card className="p-4 bg-yellow-50 border-2 border-yellow-400 mb-4">
      <Typography variant="h4" className="mb-2 text-yellow-800">
        🐛 Debug Info
      </Typography>

      <div className="space-y-2 text-xs">
        <div>
          <strong>Neynar User:</strong>{' '}
          {neynarUser
            ? `FID: ${neynarUser.fid}, Username: ${neynarUser.username}`
            : 'Not signed in'}
        </div>

        <div>
          <strong>MiniApp Context User:</strong>{' '}
          {context?.user
            ? `FID: ${context.user.fid}, Username: ${context.user.username}`
            : 'No context user'}
        </div>

        <div>
          <strong>Current Holder:</strong>{' '}
          {currentHolder
            ? `FID: ${currentHolder.fid}, Username: ${currentHolder.username}`
            : 'No holder data'}
        </div>

        <div>
          <strong>Is Current Holder:</strong> {isCurrentHolder ? '✅ YES' : '❌ NO'}
        </div>

        <div>
          <strong>Loading:</strong> {loading ? '⏳ Loading...' : '✅ Loaded'}
        </div>

        {error && (
          <div>
            <strong>Error:</strong> <span className="text-red-600">{error}</span>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-yellow-300">
          <strong>Conditions for CastingWidget:</strong>
          <ul className="ml-4 list-disc">
            <li>context?.user: {context?.user ? '✅' : '❌'}</li>
            <li>!isHolderLoading: {!loading ? '✅' : '❌'}</li>
            <li>isCurrentHolder: {isCurrentHolder ? '✅' : '❌'}</li>
          </ul>
        </div>

        <div className="mt-2 pt-2 border-t border-yellow-300">
          <strong>Should show widget:</strong>{' '}
          {context?.user && !loading && isCurrentHolder ? '✅ YES' : '❌ NO'}
        </div>
      </div>
    </Card>
  );
}
