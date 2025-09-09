'use client';

import { Typography } from '@/components/base/Typography';
import { Accordion } from '@/components/base/Accordion';
import { CHOOCHOO_TRAIN_ADDRESS, APP_URL } from '@/lib/constants';
import { sdk } from '@farcaster/miniapp-sdk';
import { Button } from '../base/Button';

export function FAQPage() {
  const handleLetEveryoneKnow = async () => {
    try {
      await sdk.actions.composeCast({
        text: 'I want to ride @choochoo! 🚂',
        embeds: [APP_URL],
      });
    } catch (error) {
      console.error('[FAQPage] Failed to compose "let everyone know" cast:', error);
    }
  };

  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      <Typography variant="h2" className="text-center mb-6 text-white">
        About ChooChoo
      </Typography>

      {/* How to Play Section */}
      <div className="space-y-4 mb-6">
        <Typography variant="h3" className="text-center mb-6 text-white">
          How to Play
        </Typography>
        <ol className="space-y-2 list-decimal list-inside text-white">
          <li>
            <Typography variant="body" className="!text-white inline">
              Get ChooChoo
            </Typography>
          </li>
          <li>
            <Typography variant="body" className="!text-white inline">
              Send a cast from the mini-app home page (you can edit it, just make sure to send it
              from the mini-app and mention `@choochoo`!)
            </Typography>
          </li>
          <li>
            <Typography variant="body" className="!text-white inline">
              Either pay 1 USDC to send ChooChoo to someone of your choice, or wait 30 minutes and
              let it go to a random person who replied to your cast
            </Typography>
          </li>
          <li>
            <Typography variant="body" className="!text-white inline">
              If ChooChoo hasn&apos;t moved in 12 hours, anyone who hasn&apos;t ridden before can
              &quot;yoink&quot; it (first come first serve!)
            </Typography>
          </li>
        </ol>

        <div className="text-center mt-4">
          <Typography variant="body" className="!text-white">
            Want to ride ChooChoo?{' '}
            <Button
              variant="link"
              onClick={handleLetEveryoneKnow}
              className="mt-2 text-gray-300 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-500 transition-colors"
            >
              Send a cast to let everyone know!
            </Button>
          </Typography>
        </div>
      </div>

      <div className="space-y-4">
        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="what-is-choochoo" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white ">
                What is ChooChoo?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white ">
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
              <Typography variant="h5" className="!text-white">
                How does it work?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white">
                When you have ChooChoo in your wallet, you can create a cast from the mini-app
                announcing that it&apos;s ready to move. Once you have casted, you can either pay 1
                USDC to select the next passenger, or leave it up to chance! If you leave it up to
                chance, after 30 minutes, anyone can select a random winner from the replies to your
                cast to ride next. A winner is randomly selected from the replies, they receive
                ChooChoo, and you get a unique ticket NFT as a souvenir of your trip!
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="contract-address" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white">
                Contract Address
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white mb-2">
                ChooChoo lives on the Base blockchain at:
              </Typography>
              <code className="text-xs !text-white bg-purple-700 p-2 rounded block break-all">
                {CHOOCHOO_TRAIN_ADDRESS}
              </code>
              <Typography variant="small" className="!text-white mt-2">
                You can view it on{' '}
                <a
                  href={`https://basescan.org/address/${CHOOCHOO_TRAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  Basescan
                </a>{' '}
                or{' '}
                <a
                  href={`https://opensea.io/assets/base/${CHOOCHOO_TRAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  OpenSea
                </a>{' '}
                to see all the journey tickets that have been minted!
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="train-movement" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white ">
                How does the train move?
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white">
                ChooChoo moves through community participation! The current holder creates a cast,
                people reply to show interest, and the current holder can either manually send
                ChooChoo or leave it up to chance! The app backend handles the contract calls,
                automatically minting a ticket to the previous holder, and transferring ChooChoo to
                the new passenger.
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="ticket-nfts" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white">
                Journey Ticket NFTs
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white">
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
