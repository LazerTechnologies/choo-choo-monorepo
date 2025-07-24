import path from 'path';

export const baseDir = process.cwd();
export const layersDir = path.join(baseDir, 'layers');

export const imageDimensions = {
  width: 1080 as const,
  height: 1080 as const,
};

// @todo: finalize collection metadata
export const collectionName = 'ChooChoo';
export const collectionDescription = 'ChooChoo on Base';

/**
 * image layer order from bottom to top.
 * @note names must match subdirectories in the `layers/` directory.
 */
export const layerOrder = [
  'background',
  'sky',
  'smoke',
  'train',
  'mouth',
  'eyes',
  'nose',
  'arch',
] as const;

/**
 * Union type of valid layer names derived from layerOrder tuple.
 */
export type LayerName = (typeof layerOrder)[number];
