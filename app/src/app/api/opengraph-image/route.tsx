import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-purple-600">
        <div tw="text-[200px] mb-8">🚂</div>
        <h1 tw="text-8xl text-white font-bold">ChooChoo</h1>
        <p tw="text-5xl mt-4 text-white opacity-80">All aboard!</p>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
