import { ImageResponse } from 'next/og';
import { APP_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const imageUrl = `${APP_URL}/ChooChoo.webp`;

  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-purple-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="ChooChoo" />
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
