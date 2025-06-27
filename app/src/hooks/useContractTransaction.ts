import { useState } from 'react';
import { usePublicClient } from 'wagmi';

/**
 * useContractTransaction
 *
 * React hook to manage the lifecycle and UI state of a blockchain transaction.
 * Handles sending a transaction, waiting for on-chain confirmation, and managing status and errors.
 *
 * @returns {UseContractTransactionResult} An object containing transaction status, hash, error, send function, and reset function.
 *
 * @example
 * const { status, txHash, sendTransaction, reset } = useContractTransaction();
 *
 * // Usage in a component:
 * const handleSend = () => sendTransaction(() => contract.someWriteMethod());
 *
 * // To reset state:
 * reset();
 *
 * // Wrapping a new hook:
 * const useCustomTransaction = () => {
 *   const { status, txHash, sendTransaction, reset } = useContractTransaction();
 *
 *   const customSend = async () => {
 *     await sendTransaction(() => contract.customWriteMethod());
 *   };
 *
 *   return { status, txHash, customSend, reset };
 * };
 */

/**
 * TransactionStatus
 *
 * Represents the possible states of a blockchain transaction.
 *
 * - 'idle': No transaction in progress
 * - 'pending': Transaction is being sent or confirmed
 * - 'success': Transaction confirmed on-chain
 * - 'error': Transaction failed or was rejected
 */
export type TransactionStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * UseContractTransactionResult
 *
 * The result object returned by useContractTransaction.
 *
 * @property {TransactionStatus} status - Current status of the transaction.
 * @property {string | null} txHash - Transaction hash if available, otherwise null.
 * @property {unknown} error - Error object if the transaction failed, otherwise null.
 * @property {(txFunc: () => Promise<string>) => Promise<void>} sendTransaction - Function to initiate a transaction.
 * @property {() => void} reset - Function to reset the transaction state to initial values.
 */
export interface UseContractTransactionResult {
  status: TransactionStatus;
  txHash: string | null;
  error: unknown;
  sendTransaction: (txFunc: () => Promise<string>) => Promise<void>;
  reset: () => void;
}

export function useContractTransaction(): UseContractTransactionResult {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const publicClient = usePublicClient();

  /**
   * Initiates a blockchain transaction, waits for confirmation, and manages its status lifecycle.
   *
   * @param txFunc - An async function that sends the transaction and returns a transaction hash.
   * @returns {Promise<void>} Resolves when the transaction is confirmed or fails.
   */
  const sendTransaction = async (
    txFunc: () => Promise<string>
  ): Promise<void> => {
    setStatus('pending');
    setTxHash(null);
    setError(null);
    try {
      const hash = await txFunc();
      setTxHash(hash);
      // Wait for on-chain confirmation
      if (!publicClient) {
        throw new Error('No public client available');
      }
      // Validate hash format before casting
      if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error('Invalid transaction hash format');
      }
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      if (receipt.status === 'success') {
        setStatus('success');
      } else {
        setStatus('error');
        setError(new Error('Transaction failed on-chain'));
      }
    } catch (err) {
      setStatus('error');
      setError(err);
    }
  };

  /**
   * Resets the transaction state to initial values.
   *
   * @returns {void}
   */
  const reset = (): void => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  };

  return { status, txHash, error, sendTransaction, reset };
}
