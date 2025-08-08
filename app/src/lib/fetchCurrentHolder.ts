export interface CurrentHolderApiResponse {
  hasCurrentHolder: boolean;
  isCurrentHolder: boolean;
  currentUserFid: number | null;
  currentHolder: null | {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    address: string;
    timestamp: string;
  };
  error?: string;
}

const TTL_MS = 10_000; // 10s client-side TTL

let cachedValue: { data: CurrentHolderApiResponse; ts: number } | null = null;
let inFlightPromise: Promise<CurrentHolderApiResponse> | null = null;

export function clearCurrentHolderCache(): void {
  cachedValue = null;
}

export async function fetchCurrentHolderCached(options?: {
  force?: boolean;
}): Promise<CurrentHolderApiResponse> {
  const force = options?.force === true;
  const now = Date.now();

  if (!force && cachedValue && now - cachedValue.ts < TTL_MS) {
    return cachedValue.data;
  }

  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = fetch('/api/current-holder')
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch current holder');
      const data = (await res.json()) as CurrentHolderApiResponse;
      cachedValue = { data, ts: Date.now() };
      return data;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}
