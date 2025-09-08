import { NextResponse } from 'next/server';
import { getFarcasterMetadata } from '../../../lib/utils';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Static manifest
    try {
      const manifestPath = join(process.cwd(), 'public', 'farcaster-manifest.json');
      const staticManifest = await readFile(manifestPath, 'utf-8');
      console.log('Using static manifest file');
      return NextResponse.json(JSON.parse(staticManifest));
    } catch (fileError) {
    }

    // Dynamic generation fallback
    const config = await getFarcasterMetadata();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
