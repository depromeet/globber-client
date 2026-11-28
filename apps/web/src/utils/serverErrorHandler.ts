import { redirect } from "next/navigation";

import { buildErrorPagePath, toErrorTypeFromStatus } from "@globber/shared/utils/errorType";

import { ApiError } from "@/lib/apiClient";

/**
 * 서버 컴포넌트에서 API 에러를 처리하고 필요시 에러 페이지로 리다이렉트합니다.
 * @param error - 발생한 에러
 * @param from - 오류가 난 화면 주소. 500 오류 화면의 "다시 시도"가 이 주소를 다시 엽니다 (GLB-135)
 * @returns 에러가 401/500이면 리다이렉트되고, 그렇지 않으면 false 반환
 */
export const handleServerError = (error: unknown, from?: string): boolean => {
  if (error instanceof ApiError) {
    const errorType = toErrorTypeFromStatus(error.status);

    if (errorType === "401" || errorType === "500") {
      redirect(buildErrorPagePath(errorType, errorType === "500" ? from : null));
    }
    return true;
  }
  return false;
};
