"use client";

import Alert from "@cloudscape-design/components/alert";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useRouter } from "next/navigation";

import { useCurrentUser, useLogout } from "@/lib/auth";

// Minimal console header (dark AWS bar). Phase 5 extends it with search and more utilities.
export default function ConsoleTopNav() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();

  return (
    <>
      <TopNavigation
        identity={{
          href: "/",
          title: "Route 53 Clone",
          onFollow: (event) => {
            // Client-side navigation instead of a full page load.
            event.preventDefault();
            router.push("/");
          },
        }}
        utilities={[
          {
            type: "menu-dropdown",
            text: user?.username,
            description: "Signed in",
            iconName: "user-profile",
            items: [{ id: "signout", text: "Sign out" }],
            onItemClick: ({ detail }) => {
              // useLogout navigates to a plain /login itself once the backend confirms.
              if (detail.id === "signout") logoutMutation.mutate();
            },
          },
        ]}
      />
      {logoutMutation.isError && (
        <Alert type="error" dismissible onDismiss={() => logoutMutation.reset()}>
          Sign out failed: {logoutMutation.error.message}. You are still signed in.
        </Alert>
      )}
    </>
  );
}
