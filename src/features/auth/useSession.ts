import { useQuery } from '@tanstack/react-query';

import { bindAuthRefreshToAppState, getSupabase } from '@/lib/supabase';

import { ensureAnonymousSession } from './session';

export const sessionQueryKey = ['auth', 'session'] as const;

/** 起動時に匿名セッションを確保する */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const supabase = getSupabase();
      bindAuthRefreshToAppState();
      return ensureAnonymousSession(supabase);
    },
    staleTime: Infinity,
  });
}
