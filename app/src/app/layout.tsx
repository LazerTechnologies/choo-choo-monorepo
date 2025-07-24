import type { Metadata } from 'next';
import { IBM_Plex_Mono, Press_Start_2P } from 'next/font/google';

import { getSession } from '@/auth';
import '@/app/globals.css';
import { Providers } from '@/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { cn } from '@/lib/utils';

const fontSans = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: '400',
});

const fontHeading = Press_Start_2P({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
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
    <html lang="en" className={cn(fontSans.variable, fontHeading.variable, 'font-sans')}>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
