import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

export async function GET() {
  const iconUrl =
    'https://scarlet-quick-grouse-388.mypinata.cloud/ipfs/bafybeibrvjscvkspyexa6lcio2lk72e6l3faqzdgr7pcmrebtwkt75lpbu';

  return new ImageResponse(
    (
      <div tw="flex h-full w-full relative bg-purple-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="ChooChoo" tw="w-full h-full object-cover object-top" />
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
