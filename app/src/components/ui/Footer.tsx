import React from 'react';
import type { Tab } from '@/components/Home';
import { Typography } from '@/components/base/Typography';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';

interface FooterProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  showWallet?: boolean;
  onYoinkClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  activeTab,
  setActiveTab,
  showWallet = false,
  onYoinkClick,
}) => {
  const countdownState = useYoinkCountdown();

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

          <Button
            onClick={() => setActiveTab('context')}
            variant={activeTab === 'context' ? 'default' : 'noShadow'}
            className={`flex items-center justify-center w-full h-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
              activeTab === 'context' ? '' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: '#a855f7' }}
          >
            <Typography variant="small" className="!text-white">
              Debug
            </Typography>
          </Button>

          {showWallet && (
            <Button
              onClick={onYoinkClick}
              variant="reverse"
              className="flex flex-col items-center justify-center w-full h-full !text-white hover:!text-gray-400 !bg-purple-500 !border-2 !border-white"
              style={{ backgroundColor: '#a855f7' }}
            >
              <Typography variant="small" className="!text-white text-xs">
                Yoink
              </Typography>
              <Typography variant="small" className="!text-white text-xs mt-0.5">
                {countdownState.isLoading ? '...' : countdownState.clockFormat}
              </Typography>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
