import Image from 'next/image';
import { useState } from 'react';
import { APP_NAME } from '@/lib/constants';
import sdk from '@farcaster/frame-sdk';
import { useMiniApp } from '@neynar/react';
import { Typography } from '@/components/base/Typography';

type HeaderProps = {
  neynarUser?: {
    fid: number;
    score: number;
  } | null;
};

export function Header({ neynarUser }: HeaderProps) {
  const { context } = useMiniApp();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [hasClickedPfp, setHasClickedPfp] = useState(false);

  return (
    <div className="relative">
      <div className="w-full py-4 px-4 bg-card border-2 shadow-md transition-all hover:shadow-xs flex items-center justify-between">
        <Typography variant="h3" className="text-foreground text-white font-comic">
          {APP_NAME}
        </Typography>
        {context?.user && (
          <button
            className="transition-all hover:translate-y-0.5 focus:outline-none"
            onClick={() => {
              setIsUserDropdownOpen(!isUserDropdownOpen);
              setHasClickedPfp(true);
            }}
          >
            {context.user.pfpUrl && (
              <Image
                src={context.user.pfpUrl}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full border-2 shadow-md hover:shadow-none transition-all"
              />
            )}
          </button>
        )}
      </div>
      {context?.user && (
        <>
          {!hasClickedPfp && (
            <div className="absolute right-0 -bottom-2 text-xs text-muted-foreground flex items-center justify-end gap-1 pr-2 font-head">
              <span className="text-[10px]">↑</span> Click PFP!{' '}
              <span className="text-[10px]">↑</span>
            </div>
          )}

          {isUserDropdownOpen && (
            <div className="absolute top-full right-0 z-50 w-fit mt-2 bg-card border-2 shadow-md rounded-lg">
              <div className="p-4 space-y-2">
                <div className="text-right">
                  <button
                    className="font-head font-bold text-sm hover:underline cursor-pointer inline-block text-foreground transition-all hover:translate-y-0.5"
                    onClick={() => sdk.actions.viewProfile({ fid: context.user.fid })}
                  >
                    {context.user.displayName || context.user.username}
                  </button>
                  <Typography variant="small" className="text-muted-foreground block">
                    @{context.user.username}
                  </Typography>
                  <Typography variant="small" className="text-muted-foreground block">
                    FID: {context.user.fid}
                  </Typography>
                  {neynarUser && (
                    <Typography variant="small" className="text-muted-foreground block">
                      Neynar Score: {neynarUser.score}
                    </Typography>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
