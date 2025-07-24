import path from 'path';

export const baseDir = path.join(process.cwd());
export const layersDir = path.join(baseDir, 'layers');

export const imageDimensions = {
  width: 1080,
  height: 1080,
};

// @todo: finalize collection metadata
export const collectionName = 'ChooChoo';
export const collectionDescription = 'ChooChoo on Base';

/**
 * image layer order from bottom to top.
 * @note names must match subdirectories in the `layers/` directory.
 */
export const layerOrder: { name: string }[] = [
  { name: 'background' },
  { name: 'sky' },
  { name: 'smoke' },
  { name: 'train' },
  { name: 'mouth' },
  { name: 'eyes' },
  { name: 'nose' },
  { name: 'arch' },
];
