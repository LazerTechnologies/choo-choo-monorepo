import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import Image from 'next/image';
import { useState } from 'react';
import { NFTImageModal } from '@/components/ui/NFTImageModal';

interface JourneyTimelineItemProps {
  username: string;
  address: string;
  nftImage: string;
  ticketNumber: number;
  date: string;
  duration: string;
  avatarSrc?: string;
}

export function JourneyTimelineItem({
  username,
  address,
  nftImage,
  ticketNumber,
  date,
  duration,
}: JourneyTimelineItemProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Truncate address to show first 6 and last 4 characters
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  // Format date to MM/DD/YY
  const formatDate = (dateString: string): string => {
    const dateObj = new Date(dateString);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  return (
    <>
      <Card className="w-full !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
        <Card.Content className="p-3">
          <div className="flex items-center gap-3">
            {/* Left: NFT Image */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-12 h-12 border-2 border-white rounded-lg overflow-hidden bg-purple-400 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <Image
                  src={nftImage}
                  alt={`Ticket #${ticketNumber}`}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>

            {/* Center: User info and details */}
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <a
                  href={`https://farcaster.xyz/${username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Typography
                    variant="label"
                    className="font-semibold !text-white truncate font-comic hover:underline transition-all"
                  >
                    @{username}
                  </Typography>
                </a>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Typography
                    variant="small"
                    className="!text-white opacity-80 truncate font-mono hover:underline transition-all"
                  >
                    {truncatedAddress}
                  </Typography>
                </a>
              </div>

              <div className="flex items-center justify-between text-xs !text-white opacity-60">
                <span className="font-comic text-xs">{formatDate(date)}</span>
                <span className="font-mono text-xs">Held {duration}</span>
              </div>
            </div>

            {/* Right: Ticket number */}
            <div className="flex-shrink-0">
              <div className="bg-white border border-white rounded px-1.5 py-0.5">
                <Typography
                  variant="small"
                  className="font-comic font-semibold !text-purple-600 text-xs"
                >
                  #{ticketNumber}
                </Typography>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <NFTImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        nftImage={nftImage}
        ticketNumber={ticketNumber}
        username={username}
        date={date}
      />
    </>
  );
}
