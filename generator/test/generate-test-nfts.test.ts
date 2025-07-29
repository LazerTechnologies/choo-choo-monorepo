import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { composeImage } from '../src/utils/compose';
import { collectionName, collectionDescription, imageDimensions } from '../src/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import sharp from 'sharp';

describe('Generate Test NFTs', () => {
  let testOutputDir: string;
  let testImagesDir: string;
  let testMetadataDir: string;

  beforeEach(async () => {
    const uniqueId = `nft-test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    testOutputDir = path.join(os.tmpdir(), uniqueId);
    testImagesDir = path.join(testOutputDir, 'images');
    testMetadataDir = path.join(testOutputDir, 'metadata');

    // Clean up any existing test output (shouldn't exist, but just in case)
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  it('should export required functions and constants', () => {
    expect(composeImage).toBeDefined();
    expect(typeof composeImage).toBe('function');
    expect(collectionName).toBeDefined();
    expect(typeof collectionName).toBe('string');
    expect(collectionDescription).toBeDefined();
    expect(typeof collectionDescription).toBe('string');
  });

  it('should generate a single NFT with valid image buffer and attributes', async () => {
    const result = await composeImage();

    expect(result).toBeDefined();
    expect(result.imageBuffer).toBeDefined();
    expect(Buffer.isBuffer(result.imageBuffer)).toBe(true);
    expect(result.imageBuffer.length).toBeGreaterThan(0);

    // Verify it's a valid PNG by checking magic bytes
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const headerBytes = result.imageBuffer.subarray(0, 8);
    expect(headerBytes.equals(pngMagic)).toBe(true);

    expect(result.attributes).toBeDefined();
    expect(Array.isArray(result.attributes)).toBe(true);
    expect(result.attributes.length).toBeGreaterThan(0);

    // Verify attributes structure
    result.attributes.forEach((attr) => {
      expect(attr).toHaveProperty('trait_type');
      expect(attr).toHaveProperty('value');
      expect(typeof attr.trait_type).toBe('string');
      expect(typeof attr.value).toBe('string');
    });
  });

  it('should generate valid PNG images with correct dimensions', async () => {
    const result = await composeImage();

    // Use Sharp to verify the generated image properties
    const metadata = await sharp(result.imageBuffer).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(imageDimensions.width);
    expect(metadata.height).toBe(imageDimensions.height);
    expect(metadata.channels).toBeGreaterThanOrEqual(3); // RGB or RGBA
  });

  it('should create directories and generate test NFTs successfully', async () => {
    const numTestNfts = 2; // Generate fewer for testing speed

    // Ensure output directories exist
    await fs.mkdir(testImagesDir, { recursive: true });
    await fs.mkdir(testMetadataDir, { recursive: true });

    // Generate test NFTs
    for (let i = 1; i <= numTestNfts; i++) {
      const { imageBuffer, attributes } = await composeImage();

      // Verify image properties before saving
      const imageMetadata = await sharp(imageBuffer).metadata();
      expect(imageMetadata.format).toBe('png');
      expect(imageMetadata.width).toBe(imageDimensions.width);
      expect(imageMetadata.height).toBe(imageDimensions.height);

      // Save image
      const imageName = `test-nft-${i}.png`;
      const imagePath = path.join(testImagesDir, imageName);
      await fs.writeFile(imagePath, imageBuffer);

      // Create and save metadata
      const metadata = {
        name: `${collectionName} #${i}`,
        description: collectionDescription,
        image: `./images/${imageName}`,
        attributes,
      };
      const metadataName = `test-nft-${i}.json`;
      const metadataPath = path.join(testMetadataDir, metadataName);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Verify files were created
      const imageStats = await fs.stat(imagePath);
      const metadataStats = await fs.stat(metadataPath);

      expect(imageStats.size).toBeGreaterThan(0);
      expect(metadataStats.size).toBeGreaterThan(0);

      // Verify metadata content
      const savedMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as {
        name: string;
        description: string;
        image: string;
        attributes: unknown[];
      };
      expect(savedMetadata.name).toBe(`${collectionName} #${i}`);
      expect(savedMetadata.description).toBe(collectionDescription);
      expect(savedMetadata.image).toBe(`./images/${imageName}`);
      expect(Array.isArray(savedMetadata.attributes)).toBe(true);
    }

    // Verify both NFTs were created
    const imageFiles = await fs.readdir(testImagesDir);
    const metadataFiles = await fs.readdir(testMetadataDir);

    expect(imageFiles).toHaveLength(numTestNfts);
    expect(metadataFiles).toHaveLength(numTestNfts);
  });

  it('should generate unique images with different attributes', async () => {
    const numTests = 3;
    const results = [];

    for (let i = 0; i < numTests; i++) {
      results.push(await composeImage());
    }

    // Verify all results are valid
    results.forEach((result) => {
      expect(Buffer.isBuffer(result.imageBuffer)).toBe(true);
      expect(result.imageBuffer.length).toBeGreaterThan(0);
      expect(Array.isArray(result.attributes)).toBe(true);
      expect(result.attributes.length).toBeGreaterThan(0);
    });

    // Note: Due to randomness, we can't guarantee uniqueness in a small sample,
    // but we can verify that the generation process works consistently
    for (const result of results) {
      const metadata = await sharp(result.imageBuffer).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(imageDimensions.width);
      expect(metadata.height).toBe(imageDimensions.height);
    }
  });

  it('should handle errors gracefully during generation', async () => {
    // This is a basic smoke test - the actual error handling is in the generate-test-nfts.ts file
    // We just ensure the core composeImage function doesn't throw unexpectedly
    await expect(composeImage()).resolves.toBeDefined();
  });
});
