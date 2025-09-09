import { NextResponse } from 'next/server';
import { getFarcasterMetadata } from '../../../lib/utils';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const config = await getFarcasterMetadata();
    
    console.log('Manifest generated with keys:', Object.keys(config));
    console.log('Frame section exists:', !!config.frame);
    console.log('WebhookUrl:', config.frame?.webhookUrl);
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
