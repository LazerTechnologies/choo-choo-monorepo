'use client';

import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';

// Admin FIDs - only these users can access admin functions
const ADMIN_FIDS = [377557, 2802, 243300];

export function useAdminAccess() {
  const { user: neynarAuthUser } = useNeynarContext();
  const { context } = useMiniApp();

  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
  const isAdmin = currentUserFid ? ADMIN_FIDS.includes(currentUserFid) : false;

  return {
    currentUserFid,
    isAdmin,
    adminFids: ADMIN_FIDS,
  };
}
