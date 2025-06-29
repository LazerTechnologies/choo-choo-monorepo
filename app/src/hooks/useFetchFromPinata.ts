import { useState, useEffect } from 'react';
import { NFTMetadata } from '@/types/nft';

/**
 * React hook to fetch NFT metadata from Pinata/IPFS by CID or tokenURI.
 *
 * @param cidOrTokenURI - The IPFS CID (or ipfs://... URI) of the metadata JSON
 * @param gateway - Optional IPFS gateway URL (default: https://gateway.pinata.cloud/ipfs/)
 * @returns { loading, error, metadata }
 */
export function useFetchFromPinata(
  cidOrTokenURI: string | null,
  gateway: string = 'https://gateway.pinata.cloud/ipfs/'
) {
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
      try {
        let cid = cidOrTokenURI;
        if (cid.startsWith('ipfs://')) {
          cid = cid.replace('ipfs://', '');
        }
        const url = `${gateway}${cid}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setMetadata(data);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to fetch metadata';
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [cidOrTokenURI, gateway]);

  return { loading, error, metadata };
}
