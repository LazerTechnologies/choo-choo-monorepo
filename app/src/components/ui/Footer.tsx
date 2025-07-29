import React from 'react';
import type { Tab } from '@/components/Home';
import { Typography } from '@/components/base/Typography';

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
}) => (
  <div className="fixed bottom-0 left-0 right-0 mx-4 mb-4 bg-card border-2 shadow-md px-2 py-2 rounded-lg z-50">
    <div className="flex justify-around items-center h-14">
      <button
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center justify-center w-full h-full transition-all hover:translate-y-0.5 font-head ${
          activeTab === 'home'
            ? 'text-primary shadow-md hover:shadow-none'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="text-xl">🏠</span>
        <Typography variant="small" className="mt-1">
          Home
        </Typography>
      </button>
      <button
        onClick={() => setActiveTab('actions')}
        className={`flex flex-col items-center justify-center w-full h-full transition-all hover:translate-y-0.5 font-head ${
          activeTab === 'actions'
            ? 'text-primary shadow-md hover:shadow-none'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="text-xl">⚡</span>
        <Typography variant="small" className="mt-1">
          Actions
        </Typography>
      </button>
      <button
        onClick={() => setActiveTab('context')}
        className={`flex flex-col items-center justify-center w-full h-full transition-all hover:translate-y-0.5 font-head ${
          activeTab === 'context'
            ? 'text-primary shadow-md hover:shadow-none'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="text-xl">📋</span>
        <Typography variant="small" className="mt-1">
          Context
        </Typography>
      </button>
      {showWallet && (
        <button
          onClick={onYoinkClick}
          className="flex flex-col items-center justify-center w-full h-full transition-all hover:translate-y-0.5 font-head text-red-500 hover:text-red-600 shadow-md hover:shadow-none"
        >
          <span className="text-xl">🚩</span>
          <Typography variant="small" className="mt-1">
            Yoink
          </Typography>
        </button>
      )}
    </div>
  </div>
);
