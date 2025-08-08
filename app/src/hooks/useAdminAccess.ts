'use client';

import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { ADMIN_FIDS } from '@/lib/constants';

export function useAdminAccess() {
  const { user: neynarAuthUser } = useNeynarContext();
  const { context } = useMiniApp();

  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
  const isAdmin = currentUserFid ? ADMIN_FIDS.includes(currentUserFid) : false;

  // Note: This is only for client/UI gating. Server routes must use requireAdmin.
  return {
    currentUserFid,
    isAdmin,
    adminFids: ADMIN_FIDS,
  };
}
