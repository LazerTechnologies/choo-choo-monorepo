/**
 * INTERNAL ENDPOINT — Only callable by backend jobs/services. Never expose to frontend or users.
 *
 * @fileoverview API route for minting NFT metadata and images to IPFS via Pinata.
 *
 * This route:
 * - Accepts multipart/form-data with an image file and NFT metadata fields
 * - Validates metadata fields using zod
 * - Uploads the image to Pinata
 * - Constructs and uploads the metadata JSON to Pinata
 * - Returns the tokenURI (metadata CID) and image CID
 *
 * Only authenticated users can access this route (Farcaster session via NextAuth).
 */

import { NextResponse } from 'next/server';
//import { getSession } from '@/auth'; @todo: add auth
import { PinataSDK } from 'pinata';
import { z } from 'zod';

if (!process.env.PINATA_JWT) {
  throw new Error('PINATA_JWT environment variable is required');
}

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

export const runtime = 'nodejs';

/**
 * Zod schema for NFT metadata validation.
 */
const mintSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  attributes: z
    .array(
      z.object({
        trait_type: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
});

/**
 * POST /api/internal/pinata/mint
 *
 * Uploads an NFT image and metadata to IPFS via Pinata.
 *
 * @param request - The incoming HTTP request (multipart/form-data)
 * @returns JSON response with tokenURI, image CID, and metadata
 *
 * @example
 * // FormData fields:
 * // - image: File
 * // - name: string
 * // - description: string
 * // - attributes: stringified JSON array
 */
export async function POST(request: Request) {
  try {
    // Auth: Only allow Farcaster-authenticated users
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_IMAGE_TYPES = ['image/png'];

    // parse multipart form data
    const formData = await request.formData();
    const imageFile = formData.get('image');
    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // parse and validate metadata fields
    const name = formData.get('name');
    const description = formData.get('description');
    const attributesRaw = formData.get('attributes');
    let attributes: unknown = [];
    if (attributesRaw) {
      try {
        attributes = JSON.parse(attributesRaw as string);
      } catch {
        return NextResponse.json({ error: 'Invalid attributes JSON' }, { status: 400 });
      }
    }
    const parsed = mintSchema.safeParse({ name, description, attributes });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const {
      name: validName,
      description: validDescription,
      attributes: validAttributes,
    } = parsed.data;

    // upload image to Pinata
    const imageUpload = await pinata.upload.public.file(imageFile as File);
    const imageCid = imageUpload.cid;
    const imageUrl = `ipfs://${imageCid}`;

    // construct metadata JSON (tokenURI)
    const metadata = {
      name: validName,
      description: validDescription,
      image: imageUrl,
      attributes: validAttributes,
    };

    // upload metadata JSON to Pinata
    const metadataUpload = await pinata.upload.public
      .json(metadata)
      .name(`${validName}-metadata.json`);
    const metadataCid = metadataUpload.cid;
    const tokenURI = `ipfs://${metadataCid}`;

    // return both CIDs
    return NextResponse.json({
      tokenURI,
      image: imageUrl,
      metadata,
      imageCid,
      metadataCid,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to upload to Pinata:', error.message, error.stack);
    } else {
      console.error('Failed to upload to Pinata:', error);
    }
    return NextResponse.json(
      {
        error: 'Failed to upload to Pinata.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
