'use client';

import { useMiniApp, useNeynarContext } from '@neynar/react';

export function useFrameContext() {
  const { context } = useMiniApp();
  const { user: neynarAuthUser } = useNeynarContext();

  // Get the current user's FID
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;

  // Create mini-app context data for admin requests
  const getFrameData = (requestData: Record<string, unknown>) => {
    // For mini-apps, we send the user's FID and context info
    // This matches the pattern used in Footer.tsx and useAdminAccess.ts
    const frameData = {
      // Include the actual request data
      ...requestData,
      // Include mini-app context for authentication
      miniAppContext: {
        isAuthenticated: !!neynarAuthUser,
        hasContext: !!context,
        userFid: currentUserFid,
      },
      // Also include FID at top level for compatibility
      fid: currentUserFid,
    };

    return frameData;
  };

  return {
    currentUserFid,
    getFrameData,
    hasFrameContext: !!context,
    isAuthenticated: !!neynarAuthUser,
  };
}
