import { ApiError, LoginRequiredError } from "@/lib/apiClient";

/**
 * 서비스 레이어가 토큰이 없을 때 던지는 안내 문구
 * 사용자에게 그대로 보여도 되는 고정 문구임
 */
export const AUTH_MISSING_MESSAGE = "인증 정보가 없습니다. 다시 로그인해주세요.";

/**
 * 다시 로그인해야 하는 오류인지 확인함
 * @param error - catch로 받은 오류
 * @returns 401 응답, 로그인 필요, 토큰 없음이면 true
 */
export const isLoginRequiredError = (error: unknown): boolean =>
  (error instanceof ApiError && error.status === 401) ||
  error instanceof LoginRequiredError ||
  (error instanceof Error && error.message === AUTH_MISSING_MESSAGE);

/**
 * 화면에 보여 줄 오류 문구를 고름
 * API 오류 원문(HTTP 상태·응답 본문)이 토스트나 안내 문구에 섞이지 않도록 로그인 안내 외에는 고정 문구를 돌려줌 (GLB-240)
 * @param error - catch로 받은 오류
 * @param fallback - 화면에 보여 줄 고정 문구
 * @returns 로그인 안내 문구 또는 fallback
 */
export const getUserErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof LoginRequiredError) return error.message;
  if (error instanceof Error && error.message === AUTH_MISSING_MESSAGE) return AUTH_MISSING_MESSAGE;
  return fallback;
};
