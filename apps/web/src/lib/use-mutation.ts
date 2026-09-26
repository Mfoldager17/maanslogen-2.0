'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';

export interface MutationState {
  pending: boolean;
  fieldErrors: Record<string, string>;
  formError: string | null;
}

/**
 * Kører en skrivning mod API'et og oversætter Problem Details til feltfejl.
 *
 * Efter succes kaldes `router.refresh()`, så server-komponenterne henter
 * data igen — i stedet for at holde en kopi af listen i klient-state, som
 * så kan komme ud af trit med databasen.
 */
export function useApiMutation() {
  const router = useRouter();
  const [state, setState] = useState<MutationState>({
    pending: false,
    fieldErrors: {},
    formError: null,
  });

  const run = useCallback(
    async <T>(
      action: () => Promise<T>,
      options: { success?: string; onSuccess?: (result: T) => void } = {},
    ): Promise<T | null> => {
      setState({ pending: true, fieldErrors: {}, formError: null });
      try {
        const result = await action();
        setState({ pending: false, fieldErrors: {}, formError: null });
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result);
        router.refresh();
        return result;
      } catch (error) {
        if (error instanceof ApiError) {
          setState({
            pending: false,
            fieldErrors: error.fieldErrors,
            formError: error.problem.detail ?? error.problem.title,
          });
          toast.error(error.problem.detail ?? error.problem.title);
        } else {
          setState({
            pending: false,
            fieldErrors: {},
            formError: 'Kunne ikke nå serveren. Prøv igen.',
          });
          toast.error('Kunne ikke nå serveren');
        }
        return null;
      }
    },
    [router],
  );

  return { ...state, run };
}
