import fs from 'fs/promises';
import path from 'path';
import { baseDir, imageDimensions, layerOrder, type LayerName } from '../config';

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
 * @returns An object containing the original filename and formatted name of the selected trait.
 */
const selectTrait = (
  layerName: LayerName,
  rarities: RarityData,
): { originalName: string; formattedName: string } => {
  const traits = rarities[layerName];
  if (!traits) {
    throw new Error(`Layer ${layerName} not found in rarity data.`);
  }
  if (Object.keys(traits).length === 0) {
    throw new Error(`Layer ${layerName} has no traits defined.`);
  }

  const totalWeight = Object.values(traits).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const [trait, weight] of Object.entries(traits)) {
    if (random < weight) {
      const formattedName = trait
        .split('.')[0]
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return { originalName: trait, formattedName };
    }
    random -= weight;
  }

  // fallback for rounding errors
  const traitNames = Object.keys(traits);
  const selectedTrait = traitNames[Math.floor(Math.random() * traitNames.length)];
  const formattedName = selectedTrait
    .split('.')[0]
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return { originalName: selectedTrait, formattedName };
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

  let rarities: RarityData;

  try {
    const fileContent = await fs.readFile(rarityDataPath, 'utf-8');
    rarities = JSON.parse(fileContent) as RarityData;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in rarities.json: ${error.message}`);
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`rarities.json not found at ${rarityDataPath}`);
    }
    throw new Error(
      `Failed to read rarities.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Validate rarity data structure
  if (!rarities || typeof rarities !== 'object') {
    throw new Error('rarities.json must contain a valid object');
  }

  // Validate that all required layers exist in rarity data
  for (const layer of layerOrder) {
    if (!(layer in rarities)) {
      throw new Error(`Layer "${layer}" is missing from rarities.json`);
    }

    const layerTraits = rarities[layer];
    if (!layerTraits || typeof layerTraits !== 'object') {
      throw new Error(`Layer "${layer}" in rarities.json must contain a valid object`);
    }

    if (Object.keys(layerTraits).length === 0) {
      throw new Error(`Layer "${layer}" in rarities.json has no traits defined`);
    }

    // Validate that all trait weights are numbers
    for (const [traitName, weight] of Object.entries(layerTraits)) {
      if (typeof weight !== 'number' || weight < 0) {
        throw new Error(
          `Invalid weight for trait "${traitName}" in layer "${layer}": must be a non-negative number`,
        );
      }
    }
  }

  const attributes: NftAttribute[] = [];
  const selectedTraits: {
    layer: LayerName;
    originalName: string;
    formattedName: string;
  }[] = [];

  // Select a trait for each layer based on the defined order and rarity
  for (const layer of layerOrder) {
    const traitData = selectTrait(layer, rarities);
    selectedTraits.push({ layer, ...traitData });

    // Format trait_type: capitalize and handle poster naming
    let formattedTraitType: string;
    if (layer.startsWith('poster')) {
      // Convert "poster1" to "Poster 1", "poster2" to "Poster 2", etc.
      const posterNumber = layer.replace('poster', '');
      formattedTraitType = `Poster ${posterNumber}`;
    } else {
      // Capitalize first letter for other traits
      formattedTraitType = layer.charAt(0).toUpperCase() + layer.slice(1);
    }

    attributes.push({
      trait_type: formattedTraitType,
      value: traitData.formattedName, // Use formatted name for metadata
    });
  }

  // Dynamically import ImageScript to avoid ESM/CJS interop issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Image } = await import('imagescript');

  // Create a blank transparent canvas
  const canvas = new Image(imageDimensions.width, imageDimensions.height);
  // Fill with transparent pixels (RGBA: 0, 0, 0, 0)
  canvas.fill(0x00000000);

  // Draw each trait layer in order (background → foreground)
  for (const { layer, originalName, formattedName } of selectedTraits) {
    // Find the numbered directory for this layer
    const layersDir = path.join(baseDir, 'layers');
    const directories = await fs.readdir(layersDir, { withFileTypes: true });
    const layerDir = directories
      .filter((dirent) => dirent.isDirectory())
      .find((dirent) => {
        const match = dirent.name.match(/^\d+_(.+)$/);
        return match && match[1] === layer;
      });

    if (!layerDir) {
      throw new Error(`Could not find directory for layer "${layer}"`);
    }

    const imagePath = path.join(layersDir, layerDir.name, originalName);

    try {
      const layerBuffer = await fs.readFile(imagePath);
      const layerImg = await Image.decode(layerBuffer);
      // Composite at the top-left corner
      canvas.composite(layerImg, 0, 0);
    } catch (error) {
      throw new Error(
        `Failed to load image for layer "${layer}", trait "${formattedName}" at ${imagePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  try {
    const pngUint8 = await canvas.encode(); // defaults to PNG
    const imageBuffer = Buffer.from(pngUint8);
    return { imageBuffer, attributes };
  } catch (error) {
    throw new Error(
      `Failed to composite final image: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
