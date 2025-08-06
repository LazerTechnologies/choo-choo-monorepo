'use client';

import { useState } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useSignerManager } from '@/hooks/useSignerManager';
import { useToast } from '@/hooks/useToast';
import axios, { AxiosError } from 'axios';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { SignerApprovalModal } from '@/components/ui/SignerApprovalModal';
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
  const { context } = useMiniApp();
  const { isCurrentHolder, loading } = useCurrentHolder();
  const {
    hasApprovedSigner,
    signerUuid,
    signerApprovalUrl,
    loading: signerLoading,
    createSigner,
  } = useSignerManager();
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const currentUserFid = user?.fid || context?.user?.fid;

  const handleApprove = async () => {
    try {
      await createSigner();
      setShowApprovalModal(true);
    } catch (error) {
      console.error('Failed to create signer:', error);
      toast({
        description: 'Failed to create signer. Please try again.',
      });
    }
  };

  const handleApprovalComplete = async () => {
    // The approval is already marked by the modal or polling
    // Just refresh the status and show success message
    setShowApprovalModal(false);

    toast({
      description: 'Signer approved successfully! You can now send casts.',
    });
  };

  const handlePublishCast = async () => {
    if (!hasApprovedSigner || !signerUuid) {
      toast({
        description: 'Please approve ChooChoo as a signer first.',
      });
      return;
    }

    setIsPublishing(true);
    try {
      await axios.post<{ message: string }>('/api/user-cast', {
        signer_uuid: signerUuid,
        text: CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST(),
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
  if (!currentUserFid || loading || !isCurrentHolder) {
    return null;
  }

  // Show loading state while checking signer status
  if (signerLoading) {
    return (
      <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
        <div className="flex justify-center">
          <Typography variant="body" className="!text-white">
            Checking signer status...
          </Typography>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {(user?.pfp_url || context?.user?.pfpUrl) && (
            <Image
              src={user?.pfp_url || context?.user?.pfpUrl || ''}
              width={40}
              height={40}
              alt="User Profile Picture"
              className="rounded-full"
            />
          )}
          <div>
            <Typography variant="body" className="font-semibold !text-white">
              {user?.display_name || context?.user?.displayName || 'Current Holder'}
            </Typography>
            <Typography variant="small" className="!text-white">
              @{user?.username || context?.user?.username || 'unknown'}
            </Typography>
          </div>
        </div>

        <div className="bg-purple-700 p-3 rounded-lg border border-white">
          <Typography variant="body" className="!text-white whitespace-pre-line">
            {CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()}
          </Typography>
        </div>

        {!hasApprovedSigner && (
          <div className="bg-yellow-100 border border-yellow-400 p-3 rounded-lg mb-4">
            <Typography variant="small" className="!text-yellow-800 text-center">
              ⚠️ Approve ChooChoo as a signer to continue
            </Typography>
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={hasApprovedSigner ? handlePublishCast : handleApprove}
            disabled={isPublishing}
            className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-8 py-2"
            style={{ backgroundColor: '#a855f7' }}
          >
            {isPublishing ? 'Sending Cast...' : hasApprovedSigner ? 'Send Cast' : 'Approve'}
          </Button>
        </div>
      </div>

      <SignerApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        approvalUrl={signerApprovalUrl || ''}
        onApprovalComplete={handleApprovalComplete}
        userFid={currentUserFid}
      />
    </Card>
  );
}
