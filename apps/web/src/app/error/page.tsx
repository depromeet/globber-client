"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { DEFAULT_ERROR_TYPE, ERROR_FROM_PARAM, ERROR_TYPE_PARAM } from "@globber/shared/constants/error";
import { toErrorType, toSafeReturnPath } from "@globber/shared/utils/errorType";

import { ErrorPageContent } from "@/components/common/ErrorPageContent";

const ErrorPageContentWrapper = () => {
  const searchParams = useSearchParams();
  const errorType = toErrorType(searchParams.get(ERROR_TYPE_PARAM));
  const retryPath = toSafeReturnPath(searchParams.get(ERROR_FROM_PARAM));

  return <ErrorPageContent errorType={errorType} retryPath={retryPath} />;
};

export default function ErrorPage() {
  return (
    <Suspense fallback={<ErrorPageContent errorType={DEFAULT_ERROR_TYPE} />}>
      <ErrorPageContentWrapper />
    </Suspense>
  );
}
