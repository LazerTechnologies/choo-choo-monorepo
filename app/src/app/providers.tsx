'use client';

import dynamic from 'next/dynamic';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { MiniAppProvider, NeynarContextProvider, Theme } from '@neynar/react';

const WagmiProvider = dynamic(() => import('@/components/providers/WagmiProvider'), {
  ssr: false,
});

export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <WagmiProvider>
        <NeynarContextProvider
          settings={{
            clientId: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || '',
            defaultTheme: Theme.Light,
            eventsCallbacks: {
              onAuthSuccess: () => {},
              onSignout: () => {},
            },
          }}
        >
          <MiniAppProvider analyticsEnabled={true} backButtonEnabled={true}>
            {children}
          </MiniAppProvider>
        </NeynarContextProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
