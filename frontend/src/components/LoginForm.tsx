"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { useCurrentUser, useLogin } from "@/lib/auth";

import styles from "./LoginForm.module.css";

function loginErrorMessage(error: Error): string {
  // 4xx carry a user-facing detail from the backend ("Invalid username or password").
  if (error instanceof ApiError && error.status < 500) return error.message;
  return "Unable to reach the sign-in service. Check that the backend is running and try again.";
}

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const loginMutation = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // One redirect path for both cases: already logged in when the page opened, or
  // just logged in (useLogin puts the user into the same cache entry).
  useEffect(() => {
    if (currentUser) router.replace(redirectTo);
  }, [currentUser, redirectTo, router]);

  const usernameError = submitted && !username.trim() ? "Enter your username." : undefined;
  const passwordError = submitted && !password ? "Enter your password." : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!username.trim() || !password) return;
    loginMutation.mutate({ username: username.trim(), password });
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <form onSubmit={handleSubmit} noValidate>
          <Form
            actions={
              <Button variant="primary" formAction="submit" loading={loginMutation.isPending}>
                Sign in
              </Button>
            }
            errorText={loginMutation.error ? loginErrorMessage(loginMutation.error) : undefined}
            errorIconAriaLabel="Error"
          >
            <Container
              header={
                <Header variant="h1" description="Route 53 Clone console">
                  Sign in
                </Header>
              }
            >
              <SpaceBetween size="l">
                <Alert type="info" header="Demo account">
                  Username <Box variant="code">admin</Box>, password{" "}
                  <Box variant="code">password123</Box>
                </Alert>
                <FormField label="Username" errorText={usernameError}>
                  <Input
                    value={username}
                    onChange={({ detail }) => setUsername(detail.value)}
                    autoComplete="username"
                    autoFocus
                    invalid={Boolean(usernameError)}
                  />
                </FormField>
                <FormField label="Password" errorText={passwordError}>
                  <Input
                    type="password"
                    value={password}
                    onChange={({ detail }) => setPassword(detail.value)}
                    autoComplete="current-password"
                    invalid={Boolean(passwordError)}
                  />
                </FormField>
              </SpaceBetween>
            </Container>
          </Form>
        </form>
      </div>
    </main>
  );
}
