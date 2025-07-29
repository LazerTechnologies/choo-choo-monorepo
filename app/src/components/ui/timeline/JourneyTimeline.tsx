import { JourneyTimelineItem } from './JourneyTimelineItem';
import { Typography } from '@/components/base/Typography';

interface JourneyTimelineProps {
  items: Array<{
    username: string;
    address: string;
    nftImage: string;
    ticketNumber: number;
    date: string;
    duration: string;
    avatarSrc?: string;
  }>;
}

export function JourneyTimeline({ items }: JourneyTimelineProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <Typography variant="h3" className="text-center mb-4 text-gray-900 dark:text-gray-100">
        Previous Stops
      </Typography>

      <div className="space-y-3">
        {items.map((item, index) => (
          <JourneyTimelineItem
            key={`${item.address}-${item.ticketNumber}-${index}`}
            username={item.username}
            address={item.address}
            nftImage={item.nftImage}
            ticketNumber={item.ticketNumber}
            date={item.date}
            duration={item.duration}
            avatarSrc={item.avatarSrc}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-8">
          <Typography variant="body" className="text-gray-500 dark:text-gray-400">
            Choo Choo is still in the station!
          </Typography>
        </div>
      )}
    </div>
  );
}
