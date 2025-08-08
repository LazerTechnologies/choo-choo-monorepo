'use client';

import { useMiniApp } from '@neynar/react';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { CurrentHolderItem } from '@/components/ui/timeline/CurrentHolderItem';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import { PublicChanceWidget } from '@/components/ui/PublicChanceWidget';
import { CastDisplayWidget } from '@/components/ui/CastDisplayWidget';
import { JourneyTimeline } from '@/components/ui/timeline';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import { useSoundPlayer } from '@/hooks/useSoundPlayer';
import { WorkflowState } from '@/lib/workflow-types';
import { APP_NAME } from '@/lib/constants';
import Image from 'next/image';

interface HomePageProps {
  title: string;
  timelineRefreshTrigger: number;
}

export function HomePage({ timelineRefreshTrigger }: HomePageProps) {
  const { context } = useMiniApp();
  const { isCurrentHolder, loading: isHolderLoading } = useCurrentHolder();
  const { workflowData, loading: isWorkflowLoading, refetch: refreshWorkflow } = useWorkflowState();
  const { playChooChoo } = useSoundPlayer();

  const handleWorkflowRefresh = () => {
    refreshWorkflow();
  };

  return (
    <div className="overflow-y-auto h-[calc(100vh-200px)] px-6">
      <div className="flex flex-col items-center justify-center py-8">
        <Typography variant="h1" className="text-center mb-4 text-white font-comic text-4xl">
          {APP_NAME}
        </Typography>
        <Image
          src="/ChooChoo.webp"
          alt="ChooChoo App Logo"
          width={320}
          height={320}
          priority
          className="rounded-lg shadow-lg border-4"
          style={{ borderColor: 'var(--border)' }}
        />
      </div>

      {/* App Description */}
      <div className="pb-6 text-center px-4">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          ChooChoo is trying to visit every wallet on Base! When ChooChoo is in your wallet, send
          out a cast below to help determine his next stop. Anyone who replies to that cast will be
          in the running to receive ChooChoo next.
        </p>
        <Button
          variant="link"
          onClick={() => playChooChoo({ volume: 0.7 })}
          className="mt-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          🚂 All aboard!
        </Button>
      </div>

      {/* Workflow-based UI rendering */}
      {context?.user && !isHolderLoading && !isWorkflowLoading && (
        <div className="w-full max-w-md mx-auto mb-8 flex flex-col items-center justify-center">
          {/* NOT_CASTED: Show casting widget only to current holder */}
          {workflowData.state === WorkflowState.NOT_CASTED && isCurrentHolder && (
            <>
              <Typography
                variant="body"
                className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
              >
                You&apos;re the current passenger! Send out a cast to let everyone know. After,
                you&apos;ll be able to choose where ChooChoo goes next.
              </Typography>
              <div className="w-full flex justify-center">
                <CastingWidget onCastSent={handleWorkflowRefresh} />
              </div>
            </>
          )}

          {/* CASTED: Show winner selection widget only to current holder */}
          {workflowData.state === WorkflowState.CASTED && isCurrentHolder && (
            <div className="w-full">
              <WinnerSelectionWidget onTokenMinted={handleWorkflowRefresh} />
            </div>
          )}

          {/* CHANCE_ACTIVE & CHANCE_EXPIRED: Show public chance widget to everyone */}
          {(workflowData.state === WorkflowState.CHANCE_ACTIVE ||
            workflowData.state === WorkflowState.CHANCE_EXPIRED) && (
            <div className="w-full space-y-4">
              <PublicChanceWidget />
              {workflowData.currentCastHash && (
                <CastDisplayWidget castHash={workflowData.currentCastHash} />
              )}
            </div>
          )}

          {/* MANUAL_SEND: Show loading state */}
          {workflowData.state === WorkflowState.MANUAL_SEND && (
            <div className="w-full text-center">
              <Typography variant="body" className="text-gray-600 dark:text-gray-300">
                🚂 ChooChoo is on the move...
              </Typography>
            </div>
          )}
        </div>
      )}

      {/* Current Stop Section */}
      <div className="w-full max-w-md mx-auto mb-8">
        <Typography
          variant="h3"
          className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
        >
          Current Stop
        </Typography>
        <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
      </div>

      <div className="pb-8">
        <JourneyTimeline refreshOnMintTrigger={timelineRefreshTrigger} />
      </div>

      {/* Credits Section */}
      <div className="pb-8 border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
        <div className="text-center space-y-2">
          <p className="text-sm text-white dark:text-white">
            Artwork by{' '}
            <a
              href="https://farcaster.xyz/yonfrula"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              @yonfrula
            </a>
          </p>
          <p className="text-sm text-white dark:text-white">
            Built by{' '}
            <a
              href="https://farcaster.xyz/jonbray.eth"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              @jonbray.eth
            </a>
          </p>
          <p className="text-sm text-white dark:text-white">
            Built on Base 🔵 | Powered by Neynar 🪐 | Only on Farcaster 💜
          </p>
        </div>
      </div>
    </div>
  );
}
