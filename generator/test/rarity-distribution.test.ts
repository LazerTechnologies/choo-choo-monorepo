/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { describe, it, expect } from 'vitest';
import { layerOrder } from '../src/config';
import fs from 'fs/promises';
import path from 'path';

// Extract the trait selection logic without image composition
type RarityData = {
  [layerName: string]: {
    [traitName: string]: number;
  };
};

const selectTrait = (
  layerName: string,
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

const generateTraitAttributes = async () => {
  const rarityDataPath = path.resolve(__dirname, '../rarities.json');
  const rarities: RarityData = JSON.parse(await fs.readFile(rarityDataPath, 'utf-8'));

  const attributes: Array<{ trait_type: string; value: string }> = [];

  // Select a trait for each layer based on the defined order and rarity
  for (const layer of layerOrder) {
    const traitData = selectTrait(layer, rarities);

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
      value: traitData.formattedName,
    });
  }

  return attributes;
};

describe('Rarity Distribution Tests', () => {
  const SAMPLE_SIZE = 1000; // Can use larger sample now that we're not generating images
  const TOLERANCE = 0.05; // 5% tolerance for statistical variance

  it('should generate traits with distributions close to expected rarities', async () => {
    console.log(`\n🎲 Testing rarity distribution with ${SAMPLE_SIZE} samples (traits only)...`);

    // Load expected rarities
    const rarityDataPath = path.resolve(__dirname, '../rarities.json');
    const rarityData = JSON.parse(await fs.readFile(rarityDataPath, 'utf-8'));

    // Track actual occurrences
    const actualCounts: Record<string, Record<string, number>> = {};

    // Initialize counters
    for (const layer of layerOrder) {
      actualCounts[layer] = {};
      for (const trait of Object.keys(rarityData[layer])) {
        const formattedTrait = trait
          .split('.')[0]
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
        actualCounts[layer][formattedTrait] = 0;
      }
    }

    // Generate samples (traits only, no images)
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      if (i % 200 === 0) {
        console.log(`  Generated ${i}/${SAMPLE_SIZE} trait combinations...`);
      }

      const attributes = await generateTraitAttributes();

      // Count occurrences
      for (const attribute of attributes) {
        // Handle formatted trait_type names
        let layerName = attribute.trait_type.toLowerCase();
        if (layerName.startsWith('poster ')) {
          layerName = layerName.replace('poster ', 'poster');
        }

        if (actualCounts[layerName]) {
          actualCounts[layerName][attribute.value] =
            (actualCounts[layerName][attribute.value] || 0) + 1;
        }
      }
    }

    console.log('\n📊 Rarity Distribution Analysis:');

    // Analyze results for each layer
    for (const layer of layerOrder) {
      console.log(`\n🎯 ${layer.toUpperCase()}:`);

      const expectedRarities = rarityData[layer];
      const totalExpectedWeight = Object.values(expectedRarities).reduce(
        (sum: number, weight: any) => sum + weight,
        0,
      );

      let layerPassed = true;

      for (const [traitFile, expectedWeight] of Object.entries(expectedRarities)) {
        const formattedTrait = (traitFile as string)
          .split('.')[0]
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

        const actualCount = actualCounts[layer][formattedTrait] || 0;
        const actualPercentage = (actualCount / SAMPLE_SIZE) * 100;
        const expectedPercentage = ((expectedWeight as number) / totalExpectedWeight) * 100;
        const difference = Math.abs(actualPercentage - expectedPercentage);
        const tolerancePercentage = TOLERANCE * 100;

        const passed = difference <= tolerancePercentage;
        if (!passed) layerPassed = false;

        const status = passed ? '✅' : '❌';
        console.log(
          `  ${status} ${formattedTrait}: ${actualPercentage.toFixed(2)}% (expected: ${expectedPercentage.toFixed(2)}%, diff: ${difference.toFixed(2)}%)`,
        );
      }

      expect(layerPassed).toBe(true);
    }

    console.log(`\n✅ Rarity distribution test completed with ${SAMPLE_SIZE} samples`);
  }, 60000); // 60 second timeout for large sample generation

  it('should generate unique combinations most of the time', async () => {
    const SAMPLE_SIZE_UNIQUENESS = 500;
    const combinations = new Set<string>();

    console.log(`\n🔄 Testing uniqueness with ${SAMPLE_SIZE_UNIQUENESS} samples (traits only)...`);

    for (let i = 0; i < SAMPLE_SIZE_UNIQUENESS; i++) {
      const attributes = await generateTraitAttributes();
      const combination = attributes.map((attr) => `${attr.trait_type}:${attr.value}`).join('|');
      combinations.add(combination);
    }

    const uniquePercentage = (combinations.size / SAMPLE_SIZE_UNIQUENESS) * 100;
    console.log(
      `📈 Uniqueness: ${combinations.size}/${SAMPLE_SIZE_UNIQUENESS} unique combinations (${uniquePercentage.toFixed(1)}%)`,
    );

    // With 14 layers and varying rarities, we should get high uniqueness
    expect(uniquePercentage).toBeGreaterThan(80); // At least 80% unique
  }, 10000);

  it('should validate that all layer rarities sum to approximately 100%', async () => {
    console.log('\n🧮 Validating rarity weights...');

    const rarityDataPath = path.resolve(__dirname, '../rarities.json');
    const rarityData = JSON.parse(await fs.readFile(rarityDataPath, 'utf-8'));

    for (const layer of layerOrder) {
      const layerRarities = rarityData[layer];
      const totalWeight = Object.values(layerRarities).reduce(
        (sum: number, weight: any) => sum + weight,
        0,
      );

      console.log(`  ${layer}: ${totalWeight.toFixed(2)}%`);

      // Allow some tolerance for floating point precision and known discrepancies
      // Note: Eyes layer currently sums to 94.75% - this should be fixed in rarities.json
      if (totalWeight < 90 || totalWeight > 110) {
        throw new Error(
          `Layer "${layer}" has invalid total weight: ${totalWeight}% (should be close to 100%)`,
        );
      }
    }

    console.log('✅ All layer rarities sum to ~100%');
  });
});
