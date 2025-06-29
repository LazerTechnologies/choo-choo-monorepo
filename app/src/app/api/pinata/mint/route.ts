/**
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
import { getSession } from '@/auth';
import { PinataSDK } from 'pinata';
import { z } from 'zod';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY, // @todo: need gateway?
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
 * POST /api/pinata/mint
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // parse multipart form data
    const formData = await request.formData();
    const imageFile = formData.get('image');
    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
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
    const metadataUpload = await pinata.upload.public.json({
      ...metadata,
      name: 'metadata.json',
    });
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
    console.error('Failed to mint and upload to Pinata:', error);
    return NextResponse.json({ error: 'Failed to mint and upload to Pinata.' }, { status: 500 });
  }
}
