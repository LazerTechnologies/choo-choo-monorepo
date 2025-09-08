'use client';

import { Typography } from '@/components/base/Typography';
import Image from 'next/image';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';
import { useEffect } from 'react';

interface NFTImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftImage: string;
  ticketNumber: number;
  username: string;
  date: string;
}

export function NFTImageModal({
  isOpen,
  onClose,
  nftImage,
  ticketNumber,
  username,
  date,
}: NFTImageModalProps) {
  // Format date from timestamp to MM/DD/YYYY
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const openSeaUrl = `https://opensea.io/item/base/${CHOOCHOO_TRAIN_ADDRESS}/${ticketNumber}`;

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-base border-2 border-border dark:border-darkBorder bg-main font-base shadow-light dark:shadow-dark"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the card itself
      >
        <div className="aspect-square w-full overflow-hidden">
          <Image
            src={nftImage}
            alt={`ChooChoo #${ticketNumber}`}
            width={400}
            height={400}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="border-t-2 border-border dark:border-darkBorder p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Typography variant="h2" className="font-sans font-bold mb-2">
                ChooChoo #{ticketNumber}
              </Typography>
              <Typography variant="body" className="mb-1">
                <span className="font-semibold">Issued to:</span> {username}
              </Typography>
              <Typography variant="body" className="text-gray-600 dark:text-gray-400">
                {formatDate(date)}
              </Typography>
            </div>

            <div className="flex-shrink-0 ml-4">
              <a
                href={openSeaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block transition-transform hover:scale-110"
              >
                <Image
                  src="/opensea.svg"
                  alt="View on OpenSea"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
