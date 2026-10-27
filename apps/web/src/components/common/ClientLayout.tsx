"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ErrorBoundary } from "./ErrorBoundary";

type ClientLayoutProps = {
  children: ReactNode;
};
export const ClientLayout = ({ children }: ClientLayoutProps) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  );
};
