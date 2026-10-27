"use client";

import { type ErrorInfo, type ReactNode, useEffect } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

type ErrorFallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>오류 아이콘</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">오류가 발생했습니다</h2>
            <p className="text-sm text-gray-600">예상치 못한 문제가 발생했습니다</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-sm text-gray-700 break-words">{error.message}</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetErrorBoundary}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            페이지 새로고침
          </button>
        </div>

        {process.env.NODE_ENV === "development" && error.stack && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">개발자 정보 보기</summary>
            <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

const handleError = (error: Error, info: ErrorInfo) => {
  if (process.env.NODE_ENV === "development") {
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
