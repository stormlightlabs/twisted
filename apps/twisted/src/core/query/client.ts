import { QueryClient } from "@tanstack/vue-query";

const isDev = import.meta.env.DEV;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isDev ? 0 : 5 * 60 * 1000,
      gcTime: isDev ? 0 : 10 * 60 * 1000,
      retry: isDev ? 0 : 2,
    },
  },
});
