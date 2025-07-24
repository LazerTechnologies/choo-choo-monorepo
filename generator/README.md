# ChooChoo NFT Image Generator

This package is responsible for the on-demand generation of NFT images and metadata for ChooChoo on Base, and is consumed by the API routes in `../app/`.

## Core Responsibilities

- The raw, layered artwork from the `layers/` directory is composed into a single PNG image using the `canvas` library.
- Define the layer order and trait rarity (`src/config.ts`) to allow weighted random generation of unique NFTs.
- Handle uploading the final generated image and the corresponding metadata JSON to Pinata, returning the IPFS content identifiers (CIDs).

## Structure

```t
generator/
├── layers/         # Raw PNG artwork, organized by layer (background, train, eyes, etc.)
├── src/
│   ├── utils/
│   │   ├── compose.ts   # Core logic for composing image layers
│   │   └── pinata.ts    # Helper for uploading assets to Pinata/IPFS
│   └── index.ts         # Entry point (exports main functions)
├── package.json    # Package dependencies and scripts
├── tsconfig.json   # TypeScript configuration
└── README.md       # Package documentation
```
