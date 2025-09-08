import type { Metadata } from 'next';
import { Comic_Relief, IBM_Plex_Mono, Public_Sans } from 'next/font/google';

import { getSession } from '@/auth';
import '@/app/globals.css';
import '@neynar/react/dist/style.css';
import { Providers } from '@/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/base/Toaster';

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: '400',
});

const fontSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: '400',
});

const fontComicFallback = Comic_Relief({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-comic-fallback',
  weight: '400',
  fallback: ['Comic Sans MS', 'cursive'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      className={cn(fontMono.variable, fontSans.variable, fontComicFallback.variable, 'font-sans')}
      style={
        {
          '--font-comic': `"Comic Sans MS", var(--font-comic-fallback), Comic Sans, cursive`,
        } as React.CSSProperties
      }
    >
      <body>
        <Providers session={session}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
