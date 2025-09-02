import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

export async function GET() {
  const iconUrl =
    'https://scarlet-quick-grouse-388.mypinata.cloud/ipfs/bafybeibrvjscvkspyexa6lcio2lk72e6l3faqzdgr7pcmrebtwkt75lpbu';

  return new ImageResponse(
    (
      <div tw="w-full h-full relative overflow-hidden bg-purple-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt="ChooChoo"
          tw="absolute top-0 left-0 w-full h-full object-cover"
          style={{
            objectFit: 'cover',
            objectPosition: 'top center',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
