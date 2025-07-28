'use client';

import dynamic from 'next/dynamic';
import { APP_NAME } from '@/lib/constants';

// note: dynamic import is required for components that use the Frame SDK
const Home = dynamic(() => import('@/components/Home'), {
  ssr: false,
});

export default function App({ title }: { title?: string } = { title: APP_NAME }) {
  return <Home title={title} />;
}
