import Image from 'next/image';
import { useState } from 'react';
import { APP_NAME } from '@/lib/constants';
import sdk from '@farcaster/frame-sdk';
import { useMiniApp } from '@neynar/react';
import { Typography } from '@/components/base/Typography';
import { Card } from '@/components/base/Card';

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
    <div className="fixed top-0 left-0 right-0 mx-4 mt-2 z-50">
      <Card
        className="py-2 px-4 w-full block !bg-purple-500 !text-white !border-white"
        style={{ backgroundColor: '#a855f7' }}
      >
        <div className="flex items-center justify-center relative">
          <Typography variant="h3" className="!text-white font-comic">
            {APP_NAME}
          </Typography>
          {context?.user && (
            <button
              className="absolute right-0 transition-all hover:translate-y-0.5 focus:outline-none"
              onClick={() => {
                setIsUserDropdownOpen(!isUserDropdownOpen);
                setHasClickedPfp(true);
              }}
            >
              {context.user.pfpUrl && (
                <Image
                  src={context.user.pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-white shadow-md hover:shadow-none transition-all"
                />
              )}
            </button>
          )}
        </div>
      </Card>
      {context?.user && (
        <>
          {!hasClickedPfp && (
            <div className="absolute right-0 -bottom-2 text-xs text-white flex items-center justify-end gap-1 pr-2 font-head">
              <span className="text-[10px]">↑</span> Click PFP!{' '}
              <span className="text-[10px]">↑</span>
            </div>
          )}

          {isUserDropdownOpen && (
            <div className="absolute top-full right-0 z-50 w-fit mt-2">
              <Card
                className="p-3 !bg-purple-500 !text-white !border-white"
                style={{ backgroundColor: '#a855f7' }}
              >
                <div className="space-y-1">
                  <div className="text-right">
                    <button
                      className="font-head font-bold text-sm hover:underline cursor-pointer inline-block !text-white transition-all hover:translate-y-0.5"
                      onClick={() => sdk.actions.viewProfile({ fid: context.user.fid })}
                    >
                      {context.user.displayName || context.user.username}
                    </button>
                    <Typography variant="small" className="!text-white block opacity-70">
                      @{context.user.username}
                    </Typography>
                    <Typography variant="small" className="!text-white block opacity-70">
                      FID: {context.user.fid}
                    </Typography>
                    {neynarUser && (
                      <Typography variant="small" className="!text-white block opacity-70">
                        Neynar Score: {neynarUser.score}
                      </Typography>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
