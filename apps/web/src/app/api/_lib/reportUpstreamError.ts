import * as Sentry from "@sentry/nextjs";

// 장애가 이어지면 사진마다 같은 오류가 나므로, 같은 원인은 이 간격에 한 번만 Sentry로 보낸다.
const REPORT_INTERVAL_MS = 10 * 60 * 1000;

const lastReportedAt = new Map<string, number>();

/**
 * Google Maps API 오류를 서버 로그에 남기고, 같은 source·status 조합은 일정 간격에 한 번만 Sentry에 보고합니다.
 *
 * @param source - 오류가 난 프록시 이름 (예: "places-proxy")
 * @param status - Google 응답 status 또는 "HTTP 503" 같은 HTTP 상태
 * @param detail - Google이 내려준 error_message 등 부가 정보
 */
export const reportUpstreamError = (source: string, status: string, detail?: string) => {
  console.error(`[${source}] Google Maps API error:`, status, detail ?? "");

  const key = `${source}:${status}`;
  const now = Date.now();
  const last = lastReportedAt.get(key);
  if (last !== undefined && now - last < REPORT_INTERVAL_MS) return;

  lastReportedAt.set(key, now);
  Sentry.captureMessage(`Google Maps API error (${source}): ${status}`, {
    level: "error",
    tags: { source, "google.status": status },
  });
};
