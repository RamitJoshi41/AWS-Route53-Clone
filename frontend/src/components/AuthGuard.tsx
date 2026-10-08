"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Spinner from "@cloudscape-design/components/spinner";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useCurrentUser } from "@/lib/auth";

/**
 * Second layer of route protection: renders its children only once GET /api/auth/me
 * confirms the session. Catches what proxy.ts can't (an expired or forged cookie)
 * and reacts to a 401 from any later API call, since that sets the user to null.
 * Its redirect keeps ?next= so the user returns to the same page after signing in
 * again. (Explicit sign-out navigates on its own, to a plain /login: see useLogout.)
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, isError, refetch, isFetching } = useCurrentUser();

  useEffect(() => {
    if (user === null) {
      // Read the URL here (client only) rather than via useSearchParams, which would
      // need a Suspense boundary around every protected page.
      const next = window.location.pathname + window.location.search;
      router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, router]);

  if (user) return children;

  if (isError) {
    // /me failed for a reason other than 401 (backend down, 5xx): don't pretend the
    // user is logged out, let them retry.
    return (
      <Box padding="xxl">
        <Alert
          type="error"
          header="Unable to verify your session"
          action={
            <Button onClick={() => refetch()} loading={isFetching}>
              Retry
            </Button>
          }
        >
          The sign-in service could not be reached. Check that the backend is running.
        </Alert>
      </Box>
    );
  }

  // Still checking (user === undefined), or redirecting to /login (user === null).
  return (
    <Box padding="xxl" textAlign="center">
      <Spinner size="large" />
    </Box>
  );
}
