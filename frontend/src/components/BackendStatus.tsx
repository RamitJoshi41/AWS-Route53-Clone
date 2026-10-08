"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useState } from "react";

import { ApiError, getHealth, type HealthStatus } from "@/lib/api";

type CheckResult =
  | { state: "loading" }
  | { state: "ok"; health: HealthStatus }
  | { state: "db-error"; health: HealthStatus }
  | { state: "unreachable"; message: string };

async function runHealthCheck(signal?: AbortSignal): Promise<CheckResult> {
  try {
    const health = await getHealth(signal);
    return { state: "ok", health };
  } catch (error) {
    // 503 = API is up but the database check failed (see backend/routers/health.py).
    if (error instanceof ApiError && error.status === 503) {
      return { state: "db-error", health: error.body as HealthStatus };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { state: "unreachable", message };
  }
}

// Temporary Phase 1 widget: proves browser → Next proxy → FastAPI → SQLite works end to end.
export default function BackendStatus() {
  // Starts as "loading" on both server and client, so SSR and hydration match.
  const [result, setResult] = useState<CheckResult>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    runHealthCheck(controller.signal).then((next) => {
      if (!controller.signal.aborted) setResult(next);
    });
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    setResult({ state: "loading" });
    setResult(await runHealthCheck());
  }, []);

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Checks GET /api/health through the Next.js proxy"
          actions={
            <Button
              iconName="refresh"
              ariaLabel="Refresh backend status"
              loading={result.state === "loading"}
              onClick={refresh}
            />
          }
        >
          Backend status
        </Header>
      }
    >
      <KeyValuePairs
        columns={3}
        items={[
          { label: "API", value: <ApiStatus result={result} /> },
          { label: "Database", value: <DatabaseStatus result={result} /> },
          {
            label: "Version",
            value: "health" in result ? result.health.version : "-",
          },
        ]}
      />
    </Container>
  );
}

function ApiStatus({ result }: { result: CheckResult }) {
  switch (result.state) {
    case "loading":
      return <StatusIndicator type="loading">Checking</StatusIndicator>;
    case "unreachable":
      return <StatusIndicator type="error">Unreachable: {result.message}</StatusIndicator>;
    default:
      return <StatusIndicator type="success">Connected</StatusIndicator>;
  }
}

function DatabaseStatus({ result }: { result: CheckResult }) {
  switch (result.state) {
    case "loading":
      return <StatusIndicator type="loading">Checking</StatusIndicator>;
    case "ok":
      return <StatusIndicator type="success">Available</StatusIndicator>;
    case "db-error":
      return <StatusIndicator type="error">Unavailable</StatusIndicator>;
    case "unreachable":
      return <StatusIndicator type="stopped">Unknown</StatusIndicator>;
  }
}
