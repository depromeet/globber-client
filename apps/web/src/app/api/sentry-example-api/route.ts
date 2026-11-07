import * as Sentry from "@sentry/nextjs";
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// Sentry 에러 모니터링을 테스트하기 위한 고의 실패 API 라우트
export function GET() {
  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError("This error is raised on the backend called by the example page.");
}
