/**
 * Transaction status type for write operations
 */
export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * Generic read result structure for ChooChoo read operations
 *
 * @template T - The type of data returned by the read operation
 */
export interface ChooChooReadResult<T> {
  value: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface ChooChooWriteResult {
  status: TransactionStatus;
  txHash: string | null;
  error: unknown;
  reset: () => void;
}
