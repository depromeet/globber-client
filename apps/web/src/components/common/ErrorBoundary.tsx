"use client";

import { type ErrorInfo, type ReactNode, useEffect } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { env } from "@/config/env";
import { reportError } from "@/utils/sentry";

import { ErrorPageContent } from "./ErrorPageContent";

type ErrorFallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

const ErrorFallback = ({ resetErrorBoundary }: ErrorFallbackProps) => (
  <ErrorPageContent errorType="500" onRetry={resetErrorBoundary} />
);

type ErrorBoundaryProps = {
  children: ReactNode;
};

const handleError = (error: Error, info: ErrorInfo) => {
  reportError(error, {
    tags: { source: "error-boundary" },
    extra: { componentStack: info.componentStack },
  });

  if (env.IS_LOCAL_DEV) {
    console.error("Error Boundary caught an error:", error);
    if (info.componentStack) {
      console.error("Component Stack:", info.componentStack);
    }
  }
};

export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection:", event.reason);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
      {children}
    </ReactErrorBoundary>
  );
};
