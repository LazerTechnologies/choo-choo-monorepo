import { composeImage } from './utils/compose';
import { collectionName, collectionDescription } from './config';
import fs from 'fs/promises';
import path from 'path';

const NUM_NFTS_TO_GENERATE = 10;
const OUTPUT_DIR = path.join(__dirname, '../out');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const METADATA_DIR = path.join(OUTPUT_DIR, 'metadata');

async function generateTestNfts() {
  console.log(`Generating ${NUM_NFTS_TO_GENERATE} test NFTs...`);

  // Ensure output directories exist
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(METADATA_DIR, { recursive: true });

  for (let i = 1; i <= NUM_NFTS_TO_GENERATE; i++) {
    console.log(`Generating NFT #${i}...`);
    try {
      const { imageBuffer, attributes } = await composeImage();

      // Save image
      const imageName = `nft-${i}.png`;
      const imagePath = path.join(IMAGES_DIR, imageName);
      await fs.writeFile(imagePath, imageBuffer);
      console.log(`Saved image: ${imagePath}`);

      // Create and save metadata
      const metadata = {
        name: `${collectionName} #${i}`,
        description: collectionDescription,
        image: `./images/${imageName}`, // Relative path for local testing
        attributes,
      };
      const metadataName = `nft-${i}.json`;
      const metadataPath = path.join(METADATA_DIR, metadataName);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Saved metadata: ${metadataPath}`);
    } catch (error) {
      console.error(`Error generating NFT #${i}:`, error);
    }
  }
  console.log('Test NFT generation complete.');
}

generateTestNfts().catch(console.error);
