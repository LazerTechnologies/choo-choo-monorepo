import path from 'path';
import fs from 'fs';

export const baseDir = process.cwd();
export const layersDir = path.join(baseDir, 'layers');

export const imageDimensions = {
  width: 2048 as const,
  height: 2048 as const,
};

// @todo: finalize collection metadata
export const collectionName = 'ChooChoo';
export const collectionDescription = 'ChooChoo on Base';

/**
 * image layer order from bottom to top.
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

/**
 * Validates that all layer names in layerOrder correspond to existing directories
 * in the layers folder, and that no extra directories exist.
 * @throws Error if validation fails
 */
export function validateLayerDirectories(): void {
  try {
    // Check if layers directory exists
    if (!fs.existsSync(layersDir)) {
      throw new Error(`Layers directory does not exist: ${layersDir}`);
    }

    // Get all subdirectories in the layers folder
    const existingDirs = fs
      .readdirSync(layersDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();

    const layerNames = [...layerOrder].sort();

    // Check for missing directories
    const missingDirs = layerNames.filter((layer) => !existingDirs.includes(layer));
    if (missingDirs.length > 0) {
      throw new Error(
        `Missing layer directories: ${missingDirs.join(', ')}. ` +
          `Expected directories in ${layersDir}: ${layerNames.join(', ')}`
      );
    }

    // Check for extra directories
    const extraDirs = existingDirs.filter(
      (dir) => !(layerNames as readonly string[]).includes(dir)
    );
    if (extraDirs.length > 0) {
      throw new Error(
        `Unexpected layer directories found: ${extraDirs.join(', ')}. ` +
          `Only expected: ${layerNames.join(', ')}. ` +
          'Either remove these directories or add them to layerOrder in config.ts'
      );
    }

    console.log(`✅ Layer directory validation passed: ${layerNames.length} layers validated`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Layer directory validation failed: ${errorMessage}`);
  }
}

/**
 * Validates layer directories synchronously for use in other modules.
 * Only validates if layers directory exists to avoid errors during build.
 */
export function validateLayerDirectoriesIfExists(): void {
  if (fs.existsSync(layersDir)) {
    validateLayerDirectories();
  }
}

// Validate layer directories on module load (only if layers directory exists)
validateLayerDirectoriesIfExists();
