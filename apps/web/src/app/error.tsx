"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_ERROR_TYPE } from "@globber/shared/constants/error";
import { buildErrorPagePath, toErrorTypeFromStatus } from "@globber/shared/utils/errorType";
import { logger } from "@globber/shared/utils/logger";

import { ErrorPageContent } from "@/components/common/ErrorPageContent";
import { env } from "@/config/env";
import type { ApiError } from "@/lib/apiClient";
import { reportError } from "@/utils/sentry";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorBoundary({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  const errorType = toErrorTypeFromStatus((error as ApiError).status);

  useEffect(() => {
    if (env.IS_LOCAL_DEV) {
      logger.error("Error boundary caught an error:", error);
    }

    reportError(error, { tags: { source: "route-error-boundary" }, extra: { digest: error.digest } });

    // 클라이언트 사이드에서 발생한 401/500 에러는 자동으로 에러 페이지로 리다이렉트
    // 서버 사이드는 서버 컴포넌트에서 이미 처리됨
    if (errorType === "401" || errorType === "500") {
      // 500은 오류 화면의 "다시 시도"가 이 화면을 다시 열 수 있도록 현재 주소를 함께 넘긴다 (GLB-135)
      const from = errorType === "500" ? `${window.location.pathname}${window.location.search}` : null;
      router.replace(buildErrorPagePath(errorType, from));
    }
  }, [error, errorType, router]);

  // 상태 코드가 없는 오류(렌더링 오류 등)는 오류 화면으로 이동하지 않고 여기서 보여 주므로, 같은 자리에서 다시 시도한다.
  // 서버 컴포넌트 데이터도 다시 받도록 refresh 후 reset한다 (GLB-135)
  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return <ErrorPageContent errorType={errorType ?? DEFAULT_ERROR_TYPE} onRetry={handleRetry} />;
}
