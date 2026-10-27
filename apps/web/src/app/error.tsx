"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_ERROR_TYPE } from "@globber/shared/constants/error";
import { buildErrorPagePath, toErrorTypeFromStatus } from "@globber/shared/utils/errorType";

import { ErrorPageContent } from "@/components/common/ErrorPageContent";
import type { ApiError } from "@/lib/apiClient";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorBoundary({ error }: ErrorPageProps) {
  const router = useRouter();

  const errorType = toErrorTypeFromStatus((error as ApiError).status);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Error boundary caught an error:", error);
    }

    // 클라이언트 사이드에서 발생한 401/500 에러는 자동으로 에러 페이지로 리다이렉트
    // 서버 사이드는 서버 컴포넌트에서 이미 처리됨
    if (errorType === "401" || errorType === "500") {
      router.replace(buildErrorPagePath(errorType));
    }
  }, [error, errorType, router]);

  return <ErrorPageContent errorType={errorType ?? DEFAULT_ERROR_TYPE} />;
}
