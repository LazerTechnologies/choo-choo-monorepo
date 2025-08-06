import React from 'react';
import type { Tab } from '@/types/app';
import { Typography } from '@/components/base/Typography';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  showWallet?: boolean;
  onYoinkClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ activeTab, setActiveTab }) => {
  const countdownState = useYoinkCountdown();
  const { user: neynarAuthUser } = useNeynarContext();
  const { context } = useMiniApp();

  // Admin FIDs - only these users can see the admin button
  const adminFids = [377557, 2802, 243300];
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
  const isAdmin = currentUserFid ? adminFids.includes(currentUserFid) : false;

  return (
    <div className="fixed bottom-0 left-0 right-0 mx-4 mb-4 z-50">
      <Card
        className="px-2 py-2 w-full block !bg-purple-500 !text-white !border-white"
        style={{ backgroundColor: '#a855f7' }}
      >
        <div className="flex justify-around items-center h-14 gap-2">
          <Button
            onClick={() => setActiveTab('home')}
            variant={activeTab === 'home' ? 'default' : 'noShadow'}
            className={`flex items-center justify-center w-full h-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
              activeTab === 'home' ? '' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: '#a855f7' }}
          >
            <Typography variant="small" className="!text-white">
              Home
            </Typography>
          </Button>

          {isAdmin && (
            <Button
              onClick={() => setActiveTab('actions')}
              variant={activeTab === 'actions' ? 'default' : 'noShadow'}
              className={`flex items-center justify-center w-full h-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
                activeTab === 'actions' ? '' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: '#a855f7' }}
            >
              <Typography variant="small" className="!text-white">
                Admin
              </Typography>
            </Button>
          )}

          <Button
            onClick={() => setActiveTab('yoink')}
            variant={activeTab === 'yoink' ? 'default' : 'noShadow'}
            className={`flex flex-col items-center justify-center w-full h-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
              activeTab === 'yoink' ? '' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: '#a855f7' }}
          >
            <Typography variant="small" className="!text-white text-xs">
              Yoink
            </Typography>
            <Typography variant="small" className="!text-white text-xs mt-0.5">
              {countdownState.isLoading ? '...' : countdownState.clockFormat}
            </Typography>
          </Button>

          <Button
            onClick={() => setActiveTab('faq')}
            variant={activeTab === 'faq' ? 'default' : 'noShadow'}
            className={`flex items-center justify-center w-full h-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
              activeTab === 'faq' ? '' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: '#a855f7' }}
          >
            <Typography variant="small" className="!text-white">
              FAQ
            </Typography>
          </Button>
        </div>
      </Card>
    </div>
  );
};
