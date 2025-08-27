'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface DepositConfig {
  usdcAddress: `0x${string}`;
  depositCost: bigint;
  decimals: number;
}

interface DepositStatusResult {
  isLoading: boolean;
  error: string | null;
  config: DepositConfig | null;
  deposited: bigint;
  required: bigint;
  satisfied: boolean;
  refresh: () => Promise<void>;
}

export function useDepositStatus(fid: number | null | undefined): DepositStatusResult {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DepositConfig | null>(null);
  const [deposited, setDeposited] = useState<bigint>(0n);
  const [required, setRequired] = useState<bigint>(0n);

  const satisfied = useMemo(() => deposited >= required && required > 0n, [deposited, required]);

  const load = useCallback(async () => {
    if (!fid) {
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Load config
      const cfgRes = await fetch('/api/deposit-config', { cache: 'no-store' });
      if (!cfgRes.ok) throw new Error('Failed to fetch deposit config');
      const cfgJson = await cfgRes.json();
      const cfg: DepositConfig = {
        usdcAddress: cfgJson?.config?.usdcAddress,
        depositCost: BigInt(cfgJson?.config?.depositCost || '0'),
        decimals: cfgJson?.config?.decimals || 6,
      };
      setConfig(cfg);
      setRequired(cfg.depositCost);

      // Load status
      const stRes = await fetch(`/api/deposit-status?fid=${fid}`, { cache: 'no-store' });
      if (!stRes.ok) throw new Error('Failed to fetch deposit status');
      const stJson = await stRes.json();
      setDeposited(BigInt(stJson?.depositStatus?.deposited || '0'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [fid]);

  useEffect(() => {
    void load();
  }, [load]);

  return { isLoading, error, config, deposited, required, satisfied, refresh: load };
}
