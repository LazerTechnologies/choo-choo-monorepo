'use client';

import Image from 'next/image';
import { Typography } from '@/components/base/Typography';
import { Card } from '@/components/base/Card';
import { APP_NAME } from '@/lib/constants';

export function MaintenanceCard() {
  return (
    <div className="space-y-6 px-6 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center justify-center">
        <Typography variant="h1" className="text-center mb-4 text-white font-comic text-4xl">
          {APP_NAME}
        </Typography>
        <Image
          src="/ChooChoo.webp"
          alt="ChooChoo App Logo"
          width={240}
          height={240}
          priority
          className="rounded-lg shadow-lg border-4"
          style={{ borderColor: 'var(--border)' }}
        />
      </div>

      <Card className="!bg-purple-600 !border-white">
        <Card.Header>
          <Card.Title className="text-center !text-white font-comic">
            🚧 Maintenance Mode
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="text-center space-y-3">
            <Typography variant="body" className="!text-white font-comic">
              ChooChoo is currently taking a quick break for maintenance!
            </Typography>
            <Typography variant="body" className="!text-white text-sm font-comic">
              We&apos;ll be back on track shortly. Thank you for your patience! 🚂
            </Typography>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
