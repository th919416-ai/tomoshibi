import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        // 画面を開き直しただけで何度も取りに行かない（静かな体験のため）
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
