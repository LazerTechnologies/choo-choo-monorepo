'use client';

import { Typography } from '@/components/base/Typography';
import { Accordion } from '@/components/base/Accordion';
import { CHOOCHOO_TRAIN_ADDRESS, APP_URL } from '@/lib/constants';
import { sdk } from '@farcaster/miniapp-sdk';
import { Button } from '../base/Button';
import { useYoinkTimer } from '@/hooks/useYoinkTimer';

export function FAQPage() {
  const { timerHours } = useYoinkTimer();

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
        <ol className="space-y-1 list-decimal list-inside text-purple-200">
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
              If ChooChoo hasn&apos;t moved in {timerHours} {timerHours === 1 ? 'hour' : 'hours'},
              anyone who hasn&apos;t ridden before can &quot;yoink&quot; it (first come first
              serve!)
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
                When you&apos;re riding ChooChoo, create a cast from the mini-app announcing that
                it&apos;s ready to move. Once you have casted, you can either:
                <ul className="space-y-1 list-inside text-purple-200">
                  <li>
                    Pay 1 USDC to select the next passenger, immediately sending ChooChoo to them
                  </li>
                  <li>
                    Leave it up to chance, after 30 minutes, anyone can select a random winner from
                    the replies to your cast to ride next
                  </li>
                </ul>
                After ChooChoo moves to the next passenger, you&apos;ll receive a unique ticket NFT
                as a souvenir of your trip!
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
                ChooChoo lives on Base:
              </Typography>
              <code className="text-xs !text-white bg-purple-700 p-2 rounded block break-all">
                <a
                  href={`https://basescan.org/address/${CHOOCHOO_TRAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  {CHOOCHOO_TRAIN_ADDRESS}
                </a>
              </code>
              <Typography variant="small" className="!text-white mt-2">
                See the contract on{' '}
                <a
                  href={`https://basescan.org/address/${CHOOCHOO_TRAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  Basescan
                </a>{' '}
                or view all the journey tickets on{' '}
                <a
                  href={`https://opensea.io/assets/base/${CHOOCHOO_TRAIN_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline"
                >
                  OpenSea.
                </a>
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
                ChooChoo only moves through Farcaster! Whether you send it, yoink it, or leave it up
                to chance, the app backend handles the contract call; sending ChooChoo to the new
                passenger and minting a ticket to the previous one.
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Accordion type="single" collapsible className="w-full">
          <Accordion.Item value="ticket-nfts" className="!bg-purple-600 !border-white">
            <Accordion.Header className="!bg-purple-600 !text-white !border-white">
              <Typography variant="h5" className="!text-white">
                Ticket NFTs
              </Typography>
            </Accordion.Header>
            <Accordion.Content className="!bg-purple-600 !text-white">
              <Typography variant="body" className="!text-white">
                Every time ChooChoo moves to a new passenger, the previous holder receives a unique
                journey ticket (tokenId: 1, 2, 3...). Unlike the main ChooChoo NFT (tokenId: 0),
                tickets contain unique artwork and traits, and can be freely transferred or traded
                on secondary markets.
              </Typography>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </div>
  );
}
