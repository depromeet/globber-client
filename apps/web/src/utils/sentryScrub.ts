import type { Event } from "@sentry/nextjs";

// 루트의 sentry.*.config.ts에서 상대 경로로 가져오므로 @/ 별칭을 쓰지 않음

const FILTERED = "[Filtered]";

/** 값을 가려야 하는 쿼리 이름 (로그인 토큰과 일회용 로그인 code) */
const SENSITIVE_QUERY_KEYS = new Set(["accesstoken", "access_token", "token", "code"]);

/** 통째로 지워야 하는 요청 헤더 (인증 쿠키와 토큰) */
const SENSITIVE_HEADER_KEYS = new Set(["cookie", "set-cookie", "authorization"]);

const BREADCRUMB_URL_KEYS = ["url", "to", "from"] as const;

const maskSearchParams = (params: URLSearchParams): boolean => {
  // 순회 중에 값을 바꾸지 않도록 키 목록을 먼저 복사함
  const sensitiveKeys = [...new Set(params.keys())].filter(key => SENSITIVE_QUERY_KEYS.has(key.toLowerCase()));
  for (const key of sensitiveKeys) params.set(key, FILTERED);
  return sensitiveKeys.length > 0;
};

/**
 * URL 문자열에서 민감한 쿼리 값을 [Filtered]로 바꿈
 * @param url - 절대 또는 상대 URL
 * @returns 민감한 쿼리가 없으면 원래 문자열, 있으면 값을 가린 URL
 */
export const maskSensitiveUrl = (url: string): string => {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;

  const hashStart = url.indexOf("#", queryStart);
  const queryEnd = hashStart === -1 ? url.length : hashStart;
  const params = new URLSearchParams(url.slice(queryStart + 1, queryEnd));
  if (!maskSearchParams(params)) return url;

  return `${url.slice(0, queryStart)}?${params.toString()}${url.slice(queryEnd)}`;
};

type QueryString = NonNullable<Event["request"]>["query_string"];

const maskQueryString = (queryString: QueryString): QueryString => {
  if (typeof queryString === "string") {
    const params = new URLSearchParams(queryString);
    return maskSearchParams(params) ? params.toString() : queryString;
  }
  if (Array.isArray(queryString)) {
    return queryString.map(([key, value]): [string, string] => [
      key,
      SENSITIVE_QUERY_KEYS.has(key.toLowerCase()) ? FILTERED : value,
    ]);
  }
  if (queryString && typeof queryString === "object") {
    return Object.fromEntries(
      Object.entries(queryString).map(([key, value]) => [
        key,
        SENSITIVE_QUERY_KEYS.has(key.toLowerCase()) ? FILTERED : value,
      ])
    );
  }
  return queryString;
};

/**
 * Sentry 이벤트(에러·트랜잭션)를 보내기 전에 인증 쿠키·토큰·로그인 code를 지움 (GLB-182)
 * beforeSend와 beforeSendTransaction에 그대로 넘겨 씀
 * @param event - Sentry가 보내려는 이벤트
 * @returns 민감 정보를 지운 같은 이벤트
 */
export const scrubSensitiveData = <T extends Event>(event: T): T => {
  const { request } = event;
  if (request) {
    delete request.cookies;
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) delete request.headers[key];
      }
    }
    if (typeof request.url === "string") request.url = maskSensitiveUrl(request.url);
    if (request.query_string !== undefined) request.query_string = maskQueryString(request.query_string);
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    const { data } = breadcrumb;
    if (!data) continue;
    for (const key of BREADCRUMB_URL_KEYS) {
      const value = data[key];
      if (typeof value === "string") data[key] = maskSensitiveUrl(value);
    }
  }

  return event;
};
