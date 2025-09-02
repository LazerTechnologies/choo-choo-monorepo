import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';

export async function GET() {
  const iconUrl =
    'https://scarlet-quick-grouse-388.mypinata.cloud/ipfs/bafybeibrvjscvkspyexa6lcio2lk72e6l3faqzdgr7pcmrebtwkt75lpbu';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#7c3aed',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt="ChooChoo"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
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
