/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { useMiniApp } from '@neynar/react';
import { useNeynarContext } from '@neynar/react';
import { MarqueeHeader } from '@/components/ui/MarqueeHeader';
import { Footer } from '@/components/ui/Footer';
import { MarqueeToastProvider } from '@/providers/MarqueeToastProvider';
import { CurrentHolderItem } from '@/components/ui/timeline/CurrentHolderItem';
import { HomePage } from '@/components/pages/HomePage';
import { AdminPage } from '@/components/pages/AdminPage';
import { FAQPage } from '@/components/pages/FAQPage';
import { YoinkPage } from '@/components/pages/YoinkPage';
import { PausedPage } from '@/components/pages/PausedPage';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
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
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingPauseState, setIsLoadingPauseState] = useState(true);

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

  // Check if app is paused on page load
  useEffect(() => {
    const fetchPauseState = async () => {
      try {
        setIsLoadingPauseState(true);
        const response = await fetch('/api/admin/app-pause/proxy', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsPaused(data.isPaused);
        }
      } catch (error) {
        console.error('Failed to fetch pause state:', error);
        // Default to not paused on error
        setIsPaused(false);
      } finally {
        setIsLoadingPauseState(false);
      }
    };

    fetchPauseState();
  }, []);

  const handleTokenMinted = () => {
    setTimelineRefreshTrigger((prev) => prev + 1);
  };

  if (!isSDKLoaded || isLoadingPauseState) {
    return <div>Loading...</div>;
  }

  return (
    <MarqueeToastProvider>
      <div
        className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900"
        style={{
          paddingTop: context?.client.safeAreaInsets?.top ?? 0,
          paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
          paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
          paddingRight: context?.client.safeAreaInsets?.right ?? 0,
        }}
      >
        <MarqueeHeader />

        <div className="mx-auto py-2 px-4 pt-16 pb-24">
          {/* Hidden CurrentHolderItem - always mounted to detect changes */}
          {/* @todo: create a useCurrentHolderDetection hook to detect when the current holder changes and refactor this and the CurrentHolderItem to use it */}
          <div className="hidden">
            <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
          </div>

          {/* Render the appropriate page component based on current tab */}
          {currentTab === 'home' &&
            (isPaused ? (
              <MaintenanceCard />
            ) : (
              <HomePage title={title} timelineRefreshTrigger={timelineRefreshTrigger} />
            ))}

          {currentTab === 'actions' && <AdminPage onTokenMinted={handleTokenMinted} />}

          {currentTab === 'faq' && <FAQPage />}

          {currentTab === 'yoink' && (isPaused ? <MaintenanceCard /> : <YoinkPage />)}

          <Footer
            activeTab={currentTab as Tab}
            setActiveTab={setActiveTab}
            showWallet={USE_WALLET}
          />
        </div>
      </div>
    </MarqueeToastProvider>
  );
}

// Export the Tab type for use by Footer and other components
export type { Tab } from '@/types/app';
