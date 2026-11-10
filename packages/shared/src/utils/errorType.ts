import { DEFAULT_ERROR_TYPE, ERROR_PAGE_PATH, ERROR_TYPE_PARAM, ERROR_TYPES } from "../constants/error";
import type { ErrorType } from "../types/error";

export const isErrorType = (value: unknown): value is ErrorType =>
  typeof value === "string" && (ERROR_TYPES as readonly string[]).includes(value);

export const toErrorType = (value: unknown): ErrorType => (isErrorType(value) ? value : DEFAULT_ERROR_TYPE);

export const toErrorTypeFromStatus = (status?: number): ErrorType | null => {
  if (status === 401) return "401";
  // 403은 권한 없는 대상의 존재 여부를 드러내지 않도록 404 화면으로 안내함
  if (status === 403 || status === 404) return "404";
  // 요청 제한 시간 초과(408, apiClient)는 일시적인 서버 문제와 같은 500 화면으로 안내함
  if (status === 408 || (status !== undefined && status >= 500)) return "500";
  return null;
};

export const buildErrorPagePath = (errorType: ErrorType): string =>
  `${ERROR_PAGE_PATH}?${ERROR_TYPE_PARAM}=${errorType}`;
