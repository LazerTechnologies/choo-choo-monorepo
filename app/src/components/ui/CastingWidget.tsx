'use client';

import { useState } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import axios, { AxiosError } from 'axios';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { Textarea } from '@/components/base/Textarea';
import Image from 'next/image';

interface ErrorRes {
  message: string;
}

export function CastingWidget() {
  const { user } = useNeynarContext();
  const { isCurrentHolder, loading } = useCurrentHolder();
  const [text, setText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishCast = async () => {
    if (!user?.signer_uuid || !text.trim()) return;

    setIsPublishing(true);
    try {
      await axios.post<{ message: string }>('/api/cast', {
        signerUuid: user.signer_uuid,
        text: text.trim(),
      });
      alert('Cast published successfully!');
      setText('');
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
    <Card className="p-4">
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
            <Typography variant="body" className="font-semibold">
              {user.display_name}
            </Typography>
            <Typography variant="small" className="text-gray-600">
              @{user.username}
            </Typography>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
          rows={4}
          className="resize-none"
          maxLength={320}
        />

        <div className="flex justify-between items-center">
          <Typography variant="small" className="text-gray-500">
            {text.length}/320 characters
          </Typography>
          <Button
            onClick={handlePublishCast}
            disabled={!text.trim() || isPublishing}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {isPublishing ? 'Publishing...' : 'Cast'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
