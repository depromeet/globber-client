import { apiPost } from "@/lib/apiClient";
import { clearAuthCookies, getValidatedAuthToken } from "@/utils/cookies";

type LogoutResponse = {
  status: string;
  data: string;
};

/**
 * 로그아웃을 진행합니다.
 * 서버 세션을 종료하고 클라이언트 쿠키를 삭제합니다.
 *
 * @param token - 선택사항. 인증 토큰
 * @throws 로그아웃 실패 시
 *
 * @example
 * await logout();
 */
export const logout = async (token?: string): Promise<void> => {
  try {
    const authToken = getValidatedAuthToken(token);

    // 서버에 로그아웃 요청
    await apiPost<LogoutResponse>("/logout", {}, authToken);

    // 클라이언트 쿠키 삭제
    clearAuthCookies();
  } catch (error) {
    // 로그아웃 실패 시에도 클라이언트 쿠키는 삭제
    clearAuthCookies();
    throw error;
  }
};
