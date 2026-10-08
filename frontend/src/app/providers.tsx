"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api";
import { currentUserQueryKey } from "@/lib/auth";

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function makeQueryClient(): QueryClient {
  // If any request reports 401, the session is gone (expired or logged out in another
  // tab). Marking the user as logged out makes the auth guard redirect to /login.
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) queryClient.setQueryData(currentUserQueryKey, null);
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // Retry network/5xx hiccups, but never 4xx: those won't fix themselves.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
  return queryClient;
}

export default function Providers({ children }: { children: ReactNode }) {
  // One client per browser tab, created once (useState initializer), never shared
  // between server requests.
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
