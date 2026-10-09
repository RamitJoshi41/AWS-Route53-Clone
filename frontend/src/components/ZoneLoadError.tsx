"use client";

import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";

/** Shown by the pages of one zone (details, edit) when it can't be loaded. */
export default function ZoneLoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const router = useRouter();
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <Alert
      type="error"
      header={notFound ? "Hosted zone not found" : "Unable to load the hosted zone"}
      action={
        notFound ? (
          <Button onClick={() => router.push("/hosted-zones")}>View hosted zones</Button>
        ) : (
          <Button onClick={onRetry}>Retry</Button>
        )
      }
    >
      {error.message}
    </Alert>
  );
}
