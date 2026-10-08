import type { Metadata } from "next";

import LoginForm from "@/components/LoginForm";
import { safeRedirectPath } from "@/lib/redirect";

export const metadata: Metadata = { title: "Sign in" };

// Server Component: reads ?next= on the server and hands the form a validated path,
// so the client form doesn't need useSearchParams (and its Suspense boundary).
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <LoginForm redirectTo={safeRedirectPath(next)} />;
}
