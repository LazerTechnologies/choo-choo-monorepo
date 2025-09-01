'use client';

import { useCallback } from 'react';
import { useMiniApp, useNeynarContext } from '@neynar/react';

export function useFrameContext() {
  const { context } = useMiniApp();
  const { user: neynarAuthUser } = useNeynarContext();

  // Get the current user's FID
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;

  // Create mini-app context data for admin requests
  const getFrameData = useCallback(
    (requestData: Record<string, unknown>) => {
      const frameData = {
        ...requestData,
        miniAppContext: {
          isAuthenticated: !!neynarAuthUser,
          hasContext: !!context,
          userFid: currentUserFid,
        },
        fid: currentUserFid,
      };

      return frameData;
    },
    [neynarAuthUser, context, currentUserFid]
  );

  return {
    currentUserFid,
    getFrameData,
    hasFrameContext: !!context,
    isAuthenticated: !!neynarAuthUser,
  };
}
