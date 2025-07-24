import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import { baseDir, imageDimensions, layerOrder } from '../config';

type RarityData = {
  [layerName: string]: {
    [traitName: string]: number;
  };
};

export type NftAttribute = {
  trait_type: string;
  value: string;
};

/**
 * Selects a random trait for a given layer based on rarity weights.
 * @param layerName - The name of the layer to select a trait for.
 * @param rarities - The rarity data object.
 * @returns The filename of the selected trait.
 */
const selectTrait = (layerName: string, rarities: RarityData): string => {
  const traits = rarities[layerName];
  if (!traits) {
    throw new Error(`Layer ${layerName} not found in rarity data.`);
  }

  const totalWeight = Object.values(traits).reduce(
    (sum, weight) => sum + weight,
    0
  );
  let random = Math.random() * totalWeight;

  for (const [trait, weight] of Object.entries(traits)) {
    if (random < weight) {
      return trait;
    }
    random -= weight;
  }

  // Fallback in case of rounding errors
  return Object.keys(traits)[0];
};

/**
 * Composes the final NFT image from selected traits and returns it as a buffer.
 * Also returns the generated attributes for the metadata.
 * @returns A promise that resolves to an object containing the image buffer and attributes.
 */
export const composeImage = async (): Promise<{
  imageBuffer: Buffer;
  attributes: NftAttribute[];
}> => {
  const rarityDataPath = path.join(baseDir, 'rarities.json');
  const rarities: RarityData = JSON.parse(
    await fs.readFile(rarityDataPath, 'utf-8')
  );

  const canvas = createCanvas(imageDimensions.width, imageDimensions.height);
  const ctx = canvas.getContext('2d');

  const attributes: NftAttribute[] = [];
  const selectedTraits: { layer: string; trait: string }[] = [];

  // Select a trait for each layer based on the defined order and rarity
  for (const layer of layerOrder) {
    const trait = selectTrait(layer.name, rarities);
    selectedTraits.push({ layer: layer.name, trait });
    attributes.push({
      trait_type: layer.name,
      value: trait.split('.')[0].replace(/_/g, ' '), // Format trait name for metadata
    });
  }

  // Draw each selected trait onto the canvas in the correct order
  for (const { layer, trait } of selectedTraits) {
    const imagePath = path.join(baseDir, 'layers', layer, trait);
    const image = await loadImage(imagePath);
    ctx.drawImage(image, 0, 0, imageDimensions.width, imageDimensions.height);
  }

  const imageBuffer = canvas.toBuffer('image/png');

  return { imageBuffer, attributes };
};
