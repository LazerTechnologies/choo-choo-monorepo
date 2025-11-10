import { useState, useEffect } from 'react';
import type { NFTMetadata } from '@/types/nft';

/**
 * React hook to fetch NFT metadata from Pinata/IPFS by CID or tokenURI.
 *
 * @param cidOrTokenURI - The IPFS CID (or ipfs://... URI) of the metadata JSON
 * @param gateway - Optional IPFS gateway URL (default: https://gateway.pinata.cloud/ipfs/)
 * @returns { loading, error, metadata }
 */
const isValidGatewayUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && url.endsWith('/');
  } catch {
    return false;
  }
};

export function useFetchFromPinata(cidOrTokenURI: string | null, gateway?: string) {
  let appGateway =
    gateway || process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

  // properly format the gateway url
  if (!gateway && process.env.NEXT_PUBLIC_PINATA_GATEWAY) {
    let envGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
    if (!envGateway.startsWith('http')) {
      envGateway = `https://${envGateway}`;
    }
    if (!envGateway.endsWith('/ipfs/') && !envGateway.endsWith('/ipfs')) {
      envGateway = envGateway.replace(/\/?$/, '/ipfs/');
    } else if (envGateway.endsWith('/ipfs')) {
      envGateway = envGateway + '/';
    }
    appGateway = envGateway;
  }
  if (!appGateway.endsWith('/')) {
    appGateway += '/';
  }

  if (!isValidGatewayUrl(appGateway)) {
    throw new Error('Invalid gateway URL provided');
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  useEffect(() => {
    if (!cidOrTokenURI) {
      setMetadata(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);
      setMetadata(null);
      const gateways = [appGateway, 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];
      let cid = cidOrTokenURI;
      if (cid.startsWith('ipfs://')) {
        cid = cid.replace('ipfs://', '');
      }
      let lastError: string | null = null;
      for (const gatewayUrl of gateways) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const url = `${gatewayUrl}${cid}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
            const data = await res.json();
            if (!cancelled) setMetadata(data);
            if (!cancelled) setError(null);
            if (!cancelled) setLoading(false);
            return;
          } catch (e: unknown) {
            lastError = e instanceof Error ? e.message : 'Failed to fetch metadata';
            // Optionally, add a small delay between retries
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
      if (!cancelled) setError(lastError || 'Failed to fetch metadata');
      if (!cancelled) setLoading(false);
    };
    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [cidOrTokenURI, appGateway]);

  return { loading, error, metadata };
}
