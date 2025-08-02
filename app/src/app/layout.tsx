import type { Metadata } from 'next';
import { Comic_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { getSession } from '@/auth';
import '@/app/globals.css';
import { Providers } from '@/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { cn } from '@/lib/utils';

const fontComic = Comic_Neue({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-comic',
  weight: '400',
});

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: '400',
});

const fontSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: '400',
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
      className={cn(fontComic.variable, fontMono.variable, fontSans.variable, 'font-comic')}
    >
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
