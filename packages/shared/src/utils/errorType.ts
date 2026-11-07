import { DEFAULT_ERROR_TYPE, ERROR_PAGE_PATH, ERROR_TYPE_PARAM, ERROR_TYPES } from "../constants/error";
import type { ErrorType } from "../types/error";

export const isErrorType = (value: unknown): value is ErrorType =>
  typeof value === "string" && (ERROR_TYPES as readonly string[]).includes(value);

export const toErrorType = (value: unknown): ErrorType => (isErrorType(value) ? value : DEFAULT_ERROR_TYPE);

export const toErrorTypeFromStatus = (status?: number): ErrorType | null => {
  if (status === 401) return "401";
  if (status === 404) return "404";
  if (status !== undefined && status >= 500) return "500";
  return null;
};

export const buildErrorPagePath = (errorType: ErrorType): string =>
  `${ERROR_PAGE_PATH}?${ERROR_TYPE_PARAM}=${errorType}`;
