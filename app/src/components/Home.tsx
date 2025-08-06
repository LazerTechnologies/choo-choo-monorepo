/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { useMiniApp } from '@neynar/react';
import { useNeynarContext } from '@neynar/react';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { CurrentHolderItem } from '@/components/ui/timeline/CurrentHolderItem';
import { HomePage } from '@/components/pages/HomePage';
import { AdminPage } from '@/components/pages/AdminPage';
import { FAQPage } from '@/components/pages/FAQPage';
import { YoinkPage } from '@/components/pages/YoinkPage';
import { USE_WALLET } from '@/lib/constants';
import type { Tab, NeynarUser } from '@/types/app';

interface HomeProps {
  title?: string;
}

export default function Home({ title = 'Choo Choo on Base' }: HomeProps) {
  const { isSDKLoaded, context, setInitialTab, setActiveTab, currentTab } = useMiniApp();
  const { user: neynarAuthUser } = useNeynarContext();

  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isSDKLoaded) {
      setInitialTab('home');
    }
  }, [isSDKLoaded, setInitialTab]);

  useEffect(() => {
    const fetchNeynarUserObject = async () => {
      if (context?.user?.fid) {
        try {
          const response = await fetch(`/api/users?fids=${context.user.fid}`);
          const data = await response.json();
          if (data.users?.[0]) {
            setNeynarUser(data.users[0]);
          }
        } catch (error) {
          console.error('Failed to fetch Neynar user object:', error);
        }
      }
    };

    fetchNeynarUserObject();
  }, [context?.user?.fid]);

  const handleTokenMinted = () => {
    setTimelineRefreshTrigger((prev) => prev + 1);
  };

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <Header neynarUser={neynarUser} />

      <div className="mx-auto py-2 px-4 pt-16 pb-24">
        {/* Hidden CurrentHolderItem - always mounted to detect changes */}
        {/* @todo: create a useCurrentHolderDetection hook to detect when the current holder changes and refactor this and the CurrentHolderItem to use it */}
        <div className="hidden">
          <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
        </div>

        {/* Render the appropriate page component based on current tab */}
        {currentTab === 'home' && (
          <HomePage title={title} timelineRefreshTrigger={timelineRefreshTrigger} />
        )}

        {currentTab === 'actions' && <AdminPage onTokenMinted={handleTokenMinted} />}

        {currentTab === 'faq' && <FAQPage />}

        {currentTab === 'yoink' && <YoinkPage />}

        <Footer activeTab={currentTab as Tab} setActiveTab={setActiveTab} showWallet={USE_WALLET} />
      </div>
    </div>
  );
}

// Export the Tab type for use by Footer and other components
export type { Tab } from '@/types/app';
