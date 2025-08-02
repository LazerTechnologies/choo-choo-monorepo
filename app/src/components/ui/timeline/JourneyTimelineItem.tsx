import { Card } from '@/components/base/Card';
import { Avatar } from '@/components/base/Avatar';
import { Typography } from '@/components/base/Typography';
import Image from 'next/image';

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
  avatarSrc,
}: JourneyTimelineItemProps) {
  // Truncate address to show first 6 and last 4 characters
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Card className="w-full">
      <Card.Content className="p-3">
        <div className="flex items-center gap-3">
          {/* Left: NFT Image */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={nftImage}
                alt={`Ticket #${ticketNumber}`}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Center: User info and details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Avatar size="sm" className="border border-gray-300">
                <Avatar.Image src={avatarSrc} alt={username} />
                <Avatar.Fallback className="bg-primary text-white text-xs font-bold">
                  {username.slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Typography
                  variant="label"
                  className="font-semibold text-gray-900 dark:text-gray-100 truncate font-comic"
                >
                  {username}
                </Typography>
                <Typography
                  variant="small"
                  className="text-gray-500 dark:text-gray-400 truncate font-mono"
                >
                  {truncatedAddress}
                </Typography>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span className="font-comic">{date}</span>
              <span className="font-mono">Held for {duration}</span>
            </div>
          </div>

          {/* Right: Ticket number */}
          <div className="flex-shrink-0">
            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md px-2 py-1">
              <Typography
                variant="small"
                className="font-comic font-semibold text-blue-800 dark:text-blue-200"
              >
                #{ticketNumber}
              </Typography>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
