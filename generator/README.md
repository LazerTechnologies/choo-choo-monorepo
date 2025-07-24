# NFT Image Generator

This package is responsible for the on-demand generation of NFT images and metadata for the Onchain Train project. It is designed to be used by the Next.js application's API routes.

## Core Responsibilities

1.  **Image Composition**: It takes raw, layered artwork from the `layers/` directory and composes them into a single PNG image using the `canvas` library.
2.  **Trait & Rarity Management**: It uses a configuration file (`src/config.ts`) to define the layer order and trait rarity, allowing for weighted random generation of unique NFTs.
3.  **IPFS Upload**: It handles uploading the final generated image and the corresponding metadata JSON to Pinata, returning the IPFS content identifiers (CIDs).

## Structure

-   `layers/`: Contains the raw PNG artwork, organized into subdirectories for each layer (e.g., `background`, `train`, `eyes`).
-   `src/config.ts`: Defines the layer structure and rarity weights for each trait.
-   `src/utils/compose.ts`: The core logic for composing the image layers.
-   `src/utils/pinata.ts`: A helper module for interacting with the Pinata API to upload assets to IPFS.
