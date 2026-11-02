"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { reportError } from "@/utils/sentry";

import { ErrorBoundary } from "./ErrorBoundary";

type ClientLayoutProps = {
  children: ReactNode;
};
export const ClientLayout = ({ children }: ClientLayoutProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // 호출부 catch에서 작업별 태그를 붙여 직접 보고하는 mutation은 건너뜀
            if (mutation.meta?.reportHandled) return;
            reportError(error, { tags: { source: "react-query" } });
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  );
};
