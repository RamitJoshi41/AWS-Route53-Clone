// Auth state, held in the React Query cache under ["me"]. That one cache entry is
// the single source of truth for "who is logged in":
//   undefined -> still checking (first /me request in flight)
//   null      -> not logged in (/me answered 401)
//   User      -> logged in
// A page reload empties the cache, so /me runs again: that's the session restore.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, getCurrentUser, login, logout, type User } from "@/lib/api";

export const currentUserQueryKey = ["me"] as const;

async function fetchCurrentUser({ signal }: { signal: AbortSignal }): Promise<User | null> {
  try {
    return await getCurrentUser(signal);
  } catch (error) {
    // 401 is an answer ("nobody is logged in"), not a failure, so it becomes data.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    // Don't re-ask on every client-side navigation. Any API call that gets a 401
    // resets this entry anyway (see providers.tsx), so an expired session is still caught.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    // Login already returns the user, so prime the cache instead of calling /me again.
    onSuccess: (user) => queryClient.setQueryData(currentUserQueryKey, user),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // An explicit sign-out ends the session for good, so go to a plain /login: no
      // ?next=, or whoever signs in next would land on the previous user's page.
      // A full page load (not router.replace) also discards every byte of the old
      // user's data held in memory, React Query cache included. It's the only
      // navigation, so it can't race <AuthGuard>, which adds ?next= for expired sessions.
      window.location.replace("/login");
    },
  });
}
