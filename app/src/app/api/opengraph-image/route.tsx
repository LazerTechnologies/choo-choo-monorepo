import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

export async function GET() {
  const iconUrl =
    'https://scarlet-quick-grouse-388.mypinata.cloud/ipfs/bafybeidv5hqsasr7asvf7vjrc2jnxh6i3afyvqwxojhjybkbq3g23p75zi';

  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-purple-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="ChooChoo" tw="w-48 h-48 mb-8" />
        <h1 tw="text-8xl text-white font-bold">ChooChoo</h1>
        <p tw="text-5xl mt-4 text-white opacity-80">All aboard the train!</p>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
