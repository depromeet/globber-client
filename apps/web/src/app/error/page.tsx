"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { DEFAULT_ERROR_TYPE, ERROR_TYPE_PARAM } from "@globber/shared/constants/error";
import { toErrorType } from "@globber/shared/utils/errorType";

import { ErrorPageContent } from "@/components/common/ErrorPageContent";

function ErrorPageContentWrapper() {
  const searchParams = useSearchParams();
  const errorType = toErrorType(searchParams.get(ERROR_TYPE_PARAM));

  return <ErrorPageContent errorType={errorType} />;
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<ErrorPageContent errorType={DEFAULT_ERROR_TYPE} />}>
      <ErrorPageContentWrapper />
    </Suspense>
  );
}
