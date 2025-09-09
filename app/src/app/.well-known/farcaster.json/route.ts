import { NextResponse } from 'next/server';
import { getFarcasterMetadata } from '../../../lib/utils';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Always generate the full config with frame section
    const config = await getFarcasterMetadata();
    
    // Check if we have MINI_APP_METADATA with accountAssociation
    if (process.env.MINI_APP_METADATA) {
      try {
        const envMetadata = JSON.parse(process.env.MINI_APP_METADATA);
        
        // Merge the accountAssociation from env with the frame config
        const mergedConfig = {
          ...config,
          ...(envMetadata.accountAssociation && { 
            accountAssociation: envMetadata.accountAssociation 
          })
        };
        
        console.log('Using merged manifest with accountAssociation from MINI_APP_METADATA');
        return NextResponse.json(mergedConfig);
      } catch (parseError) {
        console.warn('Failed to parse MINI_APP_METADATA, using dynamic config:', parseError);
      }
    }

    // Fallback to static manifest file if no env metadata
    try {
      const manifestPath = join(process.cwd(), 'public', 'farcaster-manifest.json');
      const staticManifest = await readFile(manifestPath, 'utf-8');
      const parsedManifest = JSON.parse(staticManifest);
      
      const mergedConfig = {
        ...config,
        ...(parsedManifest.accountAssociation && { 
          accountAssociation: parsedManifest.accountAssociation 
        })
      };
      
      console.log('Using merged manifest with accountAssociation from static file');
      return NextResponse.json(mergedConfig);
    } catch (fileError) {
      console.log('No static manifest file found, using dynamic config only');
    }

    // Pure dynamic generation as final fallback
    console.log('Using pure dynamic manifest generation');
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
