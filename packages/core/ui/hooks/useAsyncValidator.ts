import { useState, useCallback, useRef } from 'react';
import type { AsyncValidationStatus } from '../components/form/FormInput';

interface UseAsyncValidatorOptions {
  /** Async check function — returns true if valid, false if invalid */
  checkFn: (value: string) => Promise<boolean>;
  /** Error message when validation fails */
  errorMessage?: string;
}

interface UseAsyncValidatorReturn {
  status: AsyncValidationStatus;
  error: string | null;
  /** Call this on blur to trigger validation */
  validate: (value: string) => void;
  /** Reset to idle state */
  reset: () => void;
}

export function useAsyncValidator({
  checkFn,
  errorMessage = 'This value is already taken',
}: UseAsyncValidatorOptions): UseAsyncValidatorReturn {
  const [status, setStatus] = useState<AsyncValidationStatus>('idle');
  const lastCheckedRef = useRef<string>('');

  const validate = useCallback(
    async (value: string) => {
      if (!value) {
        setStatus('idle');
        return;
      }

      // Don't re-check the same value
      if (value === lastCheckedRef.current && status !== 'idle') return;
      lastCheckedRef.current = value;

      setStatus('checking');
      try {
        const isValid = await checkFn(value);
        // Only update if this is still the latest check
        if (value === lastCheckedRef.current) {
          setStatus(isValid ? 'valid' : 'invalid');
        }
      } catch {
        if (value === lastCheckedRef.current) {
          setStatus('idle');
        }
      }
    },
    [checkFn, status],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    lastCheckedRef.current = '';
  }, []);

  return {
    status,
    error: status === 'invalid' ? errorMessage : null,
    validate,
    reset,
  };
}
