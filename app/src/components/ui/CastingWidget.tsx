'use client';

import { useState } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useToast } from '@/hooks/useToast';
import axios, { AxiosError } from 'axios';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import Image from 'next/image';

interface ErrorRes {
  message: string;
}

interface CastingWidgetProps {
  onCastSent?: () => void;
}

export function CastingWidget({ onCastSent }: CastingWidgetProps) {
  const { user } = useNeynarContext();
  const { isCurrentHolder, loading } = useCurrentHolder();
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishCast = async () => {
    if (!user?.signer_uuid) return;

    setIsPublishing(true);
    try {
      await axios.post<{ message: string }>('/api/cast', {
        signerUuid: user.signer_uuid,
        text: CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST(),
        isUserCast: true,
      });

      // Set flag in Redis to indicate current user has casted
      await axios.post('/api/user-casted-status', {
        hasCurrentUserCasted: true,
      });

      toast({
        description: (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-comic text-sm font-semibold text-white">
                Cast published successfully!
              </div>
              <div className="text-xs text-white/90 mt-1">
                You can now wait for reactions or manually select the next passenger.
              </div>
            </div>
          </div>
        ),
      });
      onCastSent?.(); // Notify parent to refresh state
    } catch (err) {
      const { message } = (err as AxiosError).response?.data as ErrorRes;
      alert(message || 'Failed to publish cast');
    } finally {
      setIsPublishing(false);
    }
  };

  // Only show cast widget for the current holder
  if (!user || loading || !isCurrentHolder) {
    return null;
  }

  return (
    <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {user.pfp_url && (
            <Image
              src={user.pfp_url}
              width={40}
              height={40}
              alt="User Profile Picture"
              className="rounded-full"
            />
          )}
          <div>
            <Typography variant="body" className="font-semibold !text-white">
              {user.display_name}
            </Typography>
            <Typography variant="small" className="!text-white">
              @{user.username}
            </Typography>
          </div>
        </div>

        <div className="bg-purple-600 p-3 rounded-lg border border-white">
          <Typography variant="body" className="!text-white whitespace-pre-line">
            {CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()}
          </Typography>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handlePublishCast}
            disabled={isPublishing}
            className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-8 py-2"
            style={{ backgroundColor: '#a855f7' }}
          >
            {isPublishing ? 'Sending Cast...' : 'Send Cast'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
