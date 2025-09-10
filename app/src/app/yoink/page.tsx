'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/base/Spinner';
import { Typography } from '@/components/base/Typography';

/**
 * Redirect page for /yoink route
 * This ensures backwards compatibility with old notification URLs
 * that pointed to /yoink before we switched to tab-based navigation
 */
export default function YoinkRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main app with yoink tab parameter
    router.replace('/?tab=yoink');
  }, [router]);

  return (
    <div className="app-background">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-6">
            <Spinner size="xl" className="text-white mx-auto" />
          </div>
          <Typography variant="h4" className="text-white mb-2">
            🚂 All Aboard!
          </Typography>
          <Typography variant="body" className="text-white/80">
            Get ready to yoink!
          </Typography>
        </div>
      </div>
    </div>
  );
}
