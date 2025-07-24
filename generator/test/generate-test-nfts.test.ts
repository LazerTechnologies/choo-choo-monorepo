import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { composeImage } from "../src/utils/compose";
import { collectionName, collectionDescription } from "../src/config";
import fs from "fs/promises";
import path from "path";

describe("Generate Test NFTs", () => {
  const testOutputDir = path.join(__dirname, "../test-out");
  const testImagesDir = path.join(testOutputDir, "images");
  const testMetadataDir = path.join(testOutputDir, "metadata");

  beforeEach(async () => {
    // Clean up any existing test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  it("should export required functions and constants", () => {
    expect(composeImage).toBeDefined();
    expect(typeof composeImage).toBe("function");
    expect(collectionName).toBeDefined();
    expect(typeof collectionName).toBe("string");
    expect(collectionDescription).toBeDefined();
    expect(typeof collectionDescription).toBe("string");
  });

  it("should generate a single NFT with valid image buffer and attributes", async () => {
    const result = await composeImage();

    expect(result).toBeDefined();
    expect(result.imageBuffer).toBeDefined();
    expect(Buffer.isBuffer(result.imageBuffer)).toBe(true);
    expect(result.imageBuffer.length).toBeGreaterThan(0);

    expect(result.attributes).toBeDefined();
    expect(Array.isArray(result.attributes)).toBe(true);
    expect(result.attributes.length).toBeGreaterThan(0);

    // Verify attributes structure
    result.attributes.forEach((attr) => {
      expect(attr).toHaveProperty("trait_type");
      expect(attr).toHaveProperty("value");
      expect(typeof attr.trait_type).toBe("string");
      expect(typeof attr.value).toBe("string");
    });
  });

  it("should create directories and generate test NFTs successfully", async () => {
    const numTestNfts = 2; // Generate fewer for testing speed

    // Ensure output directories exist
    await fs.mkdir(testImagesDir, { recursive: true });
    await fs.mkdir(testMetadataDir, { recursive: true });

    // Generate test NFTs
    for (let i = 1; i <= numTestNfts; i++) {
      const { imageBuffer, attributes } = await composeImage();

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
      const savedMetadata = JSON.parse(
        await fs.readFile(metadataPath, "utf-8"),
      );
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

  it("should handle errors gracefully during generation", async () => {
    // This is a basic smoke test - the actual error handling is in the generate-test-nfts.ts file
    // We just ensure the core composeImage function doesn't throw unexpectedly
    await expect(composeImage()).resolves.toBeDefined();
  });
});
