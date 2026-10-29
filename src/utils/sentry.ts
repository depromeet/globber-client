import * as Sentry from "@sentry/nextjs";

import { ApiError } from "@/lib/apiClient";

type ReportContext = {
  /** Sentry 이슈 검색/필터에 쓰이는 태그 (예: { feature: "photo_upload" }) */
  tags?: Record<string, string>;
  /** 이벤트 상세에 함께 남길 부가 정보 */
  extra?: Record<string, unknown>;
};

// 같은 에러가 mutation 캐시와 호출부 catch에서 중복 보고되지 않도록 기록
const reportedErrors = new WeakSet<object>();

// 서비스 레이어가 토큰이 없을 때 던지는 에러 메시지 (ApiError가 아닌 일반 Error)
const AUTH_MISSING_MESSAGE = "인증 정보가 없습니다. 다시 로그인해주세요.";

// 인증 만료(401)와 토큰 없음은 다시 로그인해야 하는 상황이므로 보고하지 않음
const shouldIgnore = (error: unknown) => {
  if (error instanceof ApiError) return error.status === 401;
  return error instanceof Error && error.message === AUTH_MISSING_MESSAGE;
};

// apiClient가 에러 메시지 뒤에 붙이는 서버 응답 본문 (서비스에서 다른 문구로 감싼 경우도 포함)
const RESPONSE_BODY_PATTERN = /(HTTP error! status: \d+) - [\s\S]*$/;

// apiClient로 호출하는 endpoint 템플릿. 앞에 있는 템플릿이 먼저 매칭됨
const ENDPOINT_TEMPLATES = [
  "/api/v1/bookmarks",
  "/api/v1/bookmarks/:id",
  "/api/v1/cities",
  "/api/v1/cities/favorites",
  "/api/v1/cities/:id",
  "/api/v1/diaries",
  "/api/v1/diaries/photo/:id",
  "/api/v1/diaries/photo/:id/:id",
  "/api/v1/diaries/:id",
  "/api/v1/diaries/:id/emojis/press",
  "/api/v1/diaries/:id/emojis/register",
  "/api/v1/globes/:id",
  "/api/v1/member-travels",
  "/api/v1/member-travels/:id/records",
  "/api/v1/travel-insights/:id",
  "/api/v1/profiles/me",
  "/api/v1/profiles/me/image",
  "/api/v1/s3/upload-url",
  "/id",
  "/logout",
  "/withdraw",
].map(template => template.split("/"));

const UNKNOWN_ENDPOINT = "unknown";

// 쿼리스트링(uuid 등)을 지우고, 식별자 구간을 :id로 바꾼 템플릿을 반환. 매칭되지 않으면 원문 대신 unknown
const normalizeEndpoint = (endpoint: string) => {
  const segments = endpoint.split("?")[0].split("/");
  const matched = ENDPOINT_TEMPLATES.find(
    template =>
      template.length === segments.length && template.every((part, index) => part === ":id" || part === segments[index])
  );
  return matched ? matched.join("/") : UNKNOWN_ENDPOINT;
};

/**
 * 서버 응답 본문과 식별자를 뺀 사본을 만듭니다.
 * 화면에서 쓰는 원본 에러는 그대로 두고, stack 첫 줄에 남는 원문 메시지도 함께 바꿉니다.
 */
const toReportableError = (error: unknown) => {
  if (!(error instanceof Error)) return error;

  const message = error.message.replace(RESPONSE_BODY_PATTERN, "$1");
  if (!(error instanceof ApiError) && message === error.message) return error;

  const safe =
    error instanceof ApiError
      ? new ApiError(message, error.status, normalizeEndpoint(error.endpoint))
      : new Error(message);
  safe.name = error.name;
  safe.stack = error.stack?.replace(error.message, () => message);
  return safe;
};

/**
 * catch로 처리한 에러를 Sentry에 보고합니다.
 * 처리되지 않은 에러는 SDK가 자동 수집하므로, 사용자에게 alert 등으로 안내하고 끝나는 에러에 사용합니다.
 */
export const reportError = (error: unknown, context: ReportContext = {}) => {
  if (shouldIgnore(error)) return;

  if (typeof error === "object" && error !== null) {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
  }

  const reportable = toReportableError(error);

  Sentry.withScope(scope => {
    if (reportable instanceof ApiError) {
      scope.setTag("api.status", String(reportable.status));
      scope.setTag("api.endpoint", reportable.endpoint);
    }
    if (context.tags) scope.setTags(context.tags);
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(reportable);
  });
};
