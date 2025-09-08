'use client';

import Image from 'next/image';
import { Typography } from '@/components/base/Typography';
import { Card } from '@/components/base/Card';
import { APP_NAME } from '@/lib/constants';

export function PausedPage() {
  return (
    <div className="overflow-y-auto h-[calc(100vh-200px)] px-6">
      <div className="flex flex-col items-center justify-center py-8">
        <Typography variant="h1" className="text-center mb-4 text-white text-4xl">
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

      {/* Maintenance Message */}
      <div className="w-full max-w-md mx-auto">
        <Card className="!bg-purple-600 !border-white">
          <Card.Header>
            <Card.Title className="text-center !text-white">🚧 Maintenance Mode</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="text-center space-y-3">
              <Typography variant="body" className="!text-white">
                ChooChoo is currently taking a quick break for maintenance!
              </Typography>
              <Typography variant="body" className="!text-white text-sm">
                We&apos;ll be back on track shortly. Thank you for your patience! 🚂
              </Typography>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
