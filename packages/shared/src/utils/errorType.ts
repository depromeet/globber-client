import {
  DEFAULT_ERROR_TYPE,
  ERROR_FROM_PARAM,
  ERROR_PAGE_PATH,
  ERROR_TYPE_PARAM,
  ERROR_TYPES,
} from "../constants/error";
import type { ErrorType } from "../types/error";

export const isErrorType = (value: unknown): value is ErrorType =>
  typeof value === "string" && (ERROR_TYPES as readonly string[]).includes(value);

export const toErrorType = (value: unknown): ErrorType => (isErrorType(value) ? value : DEFAULT_ERROR_TYPE);

export const toErrorTypeFromStatus = (status?: number): ErrorType | null => {
  if (status === 401) return "401";
  if (status === 404) return "404";
  // 요청 제한 시간 초과(408, apiClient)는 일시적인 서버 문제와 같은 500 화면으로 안내한다
  if (status === 408 || (status !== undefined && status >= 500)) return "500";
  return null;
};

const MAX_RETURN_PATH_LENGTH = 2000;
// 상대 경로를 해석할 때만 쓰는 가짜 출처. 해석 결과의 출처가 이 값과 다르면 다른 사이트로 가는 주소다.
const PLACEHOLDER_ORIGIN = "https://return-path.invalid";

/**
 * 오류 화면에서 다시 열 주소로 써도 되는 값인지 확인해, 같은 사이트의 경로만 돌려줍니다.
 * 다른 사이트로 보내는 주소(//evil.com, /\\evil.com, 제어 문자가 섞인 주소, https://...)와 오류 화면 자신은 거릅니다.
 */
export const toSafeReturnPath = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > MAX_RETURN_PATH_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  // "/x/..//evil.com"처럼 정리 후 "//"로 시작하는 경로는 브라우저가 다른 사이트 주소로 해석하므로 거른다
  if (url.pathname.startsWith("//") || url.pathname.startsWith("/\\")) return null;
  if (url.pathname === ERROR_PAGE_PATH || url.pathname.startsWith(`${ERROR_PAGE_PATH}/`)) return null;

  return `${url.pathname}${url.search}${url.hash}`;
};

/**
 * 오류 화면 주소를 만듭니다. from에 오류가 난 화면 주소를 넘기면 오류 화면의 "다시 시도"가 그 화면을 다시 엽니다.
 */
export const buildErrorPagePath = (errorType: ErrorType, from?: string | null): string => {
  const params = new URLSearchParams({ [ERROR_TYPE_PARAM]: errorType });
  const safeFrom = toSafeReturnPath(from);
  if (safeFrom) params.set(ERROR_FROM_PARAM, safeFrom);
  return `${ERROR_PAGE_PATH}?${params.toString()}`;
};
