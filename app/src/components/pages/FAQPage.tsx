'use client';

import { Typography } from '@/components/base/Typography';
import { Accordion } from '@/components/base/Accordion';
import { CHOOCHOO_TRAIN_ADDRESS } from '@/lib/constants';

export function FAQPage() {
  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      <Typography variant="h2" className="text-center mb-6 text-white font-comic">
        About ChooChoo
      </Typography>

      <div className="space-y-4">
        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="what-is-choochoo" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white font-comic">
                What is ChooChoo?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white font-comic">
                ChooChoo is a social experiment and NFT game built on Base! It&apos;s a unique train
                that travels from wallet to wallet across the Farcaster community. When ChooChoo
                visits your wallet, you become the current passenger and get to help decide where it
                goes next. Each previous passenger receives a special journey ticket NFT as proof of
                their ride.
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="how-it-works" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white font-comic">
                How does it work?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white font-comic">
                When you have ChooChoo in your wallet, you can create a cast announcing that
                it&apos;s ready to move. Other Farcaster users reply to your cast to get in line for
                the next ride. A winner is randomly selected from the replies, they receive ChooChoo
                (tokenId: 0), and you get a unique journey ticket NFT as a souvenir of your trip!
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="contract-address" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white font-comic">
                Contract Address
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white mb-2 font-comic">
                ChooChoo lives on the Base blockchain at:
              </Typography>
              <code className="text-xs !text-white bg-purple-700 p-2 rounded block break-all font-comic">
                {CHOOCHOO_TRAIN_ADDRESS}
              </code>
              <Typography variant="small" className="!text-white mt-2 font-comic">
                You can view it on Basescan or OpenSea to see all the journey tickets that have been
                minted!
              </Typography>
              {/* @todo: add links and icons for basescan and opensea */}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="train-movement" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white font-comic">
                How does the train move?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white font-comic">
                ChooChoo moves through community participation! The current holder creates a cast,
                people reply to show interest, and then anyone can trigger the &quot;next stop&quot;
                selection. Our backend randomly picks a winner from the replies, automatically mints
                a journey ticket to the previous holder, and transfers ChooChoo to the new
                passenger. It&apos;s fully automated and transparent!
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="ticket-nfts" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white font-comic">
                Journey Ticket NFTs
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white font-comic">
                Every time ChooChoo moves to a new passenger, the previous holder receives a unique
                journey ticket NFT (tokenId: 1, 2, 3...). These are procedurally generated artworks
                that serve as proof of your ride and collectible souvenirs. Each ticket is unique
                and represents a specific stop in ChooChoo&apos;s journey across Base. Only ChooChoo
                itself (tokenId: 0) moves between wallets!
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </div>
  );
}
