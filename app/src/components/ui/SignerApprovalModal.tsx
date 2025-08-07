'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Typography } from '@/components/base/Typography';
import { Button } from '@/components/base/Button';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((mod) => mod.QRCodeSVG), {
  ssr: false,
});

interface SignerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvalUrl: string;
  onApprovalComplete?: () => void;
  userFid?: number;
}

export function SignerApprovalModal({
  isOpen,
  onClose,
  approvalUrl,
  onApprovalComplete,
  userFid,
}: SignerApprovalModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    // Check if user is on mobile device
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
      setIsMobile(isMobileDevice);
    };

    checkIsMobile();
  }, []);

  // Polling effect to check if signer has been approved
  useEffect(() => {
    if (!isOpen || !userFid) return;

    setIsPolling(true);

    // Wait 5 seconds before starting to poll (give user time to approve)
    const startDelay = setTimeout(() => {
      const pollInterval = setInterval(async () => {
        try {
          // First try to mark as approved (in case user already approved)
          await fetch('/api/signer/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: userFid }),
          });

          // Then check status
          const response = await fetch(`/api/signer/check?fid=${userFid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.hasApprovedSigner) {
              setIsPolling(false);
              clearInterval(pollInterval);
              onApprovalComplete?.();
            }
          }
        } catch (error) {
          console.error('Error polling signer status:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Stop polling after 5 minutes
      const timeout = setTimeout(
        () => {
          setIsPolling(false);
          clearInterval(pollInterval);
        },
        5 * 60 * 1000
      );

      return () => {
        setIsPolling(false);
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }, 5000);

    return () => {
      setIsPolling(false);
      clearTimeout(startDelay);
    };
  }, [isOpen, userFid, onApprovalComplete]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent background scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleDeeplink = () => {
    window.open(approvalUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-base border-2 border-white bg-purple-500"
        style={{ backgroundColor: '#a855f7' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <Typography variant="h3" className="font-comic font-bold mb-3 !text-white text-center">
            Approve ChooChoo
          </Typography>

          <Typography variant="small" className="!text-white mb-4 text-center">
            Approve ChooChoo as a signer in Warpcast to send casts.
          </Typography>

          {isPolling && (
            <Typography variant="small" className="!text-blue-200 text-center mb-3">
              🔄 Waiting for approval...
            </Typography>
          )}

          {isMobile ? (
            <div className="space-y-3">
              <Typography variant="small" className="!text-white text-center">
                Tap to open Warpcast:
              </Typography>

              <div className="flex justify-center">
                <Button
                  onClick={handleDeeplink}
                  className="!text-white hover:!text-white !bg-purple-700 !border-2 !border-white"
                >
                  Open Warpcast
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Typography variant="small" className="!text-white text-center">
                Scan with your mobile device:
              </Typography>

              <div className="flex justify-center bg-white p-3 rounded-lg">
                <QRCodeSVG value={approvalUrl} size={150} />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={onClose}
              variant="secondary"
              className="w-full !text-purple-500 hover:!text-purple-500 !bg-white !border-2 !border-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
