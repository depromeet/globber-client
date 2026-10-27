import { apiPost } from "@/lib/apiClient";
import { getValidatedAuthToken } from "@/utils/cookies";

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

/**
 * 인증 관련 쿠키를 모두 삭제합니다.
 */
const clearAuthCookies = (): void => {
  if (typeof document === "undefined") return;

  const cookies = ["kakao_access_token", "member_id", "uuid"];
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || /^[0-9.]+$/.test(hostname);

  // domain 후보: (1) 지정 안 함, (2) 현재 호스트, (3) 부모 도메인들(.example.com 등)
  const parentDomains = isLocalhost
    ? []
    : (() => {
        const parts = hostname.split(".");
        const acc: string[] = [];
        for (let i = 1; i < parts.length - 0; i++) {
          const d = `.${parts.slice(i).join(".")}`;
          acc.push(d);
        }
        return Array.from(new Set([hostname, ...acc]));
      })();

  const domainCandidates: (string | undefined)[] = [undefined, ...parentDomains];

  for (const name of cookies) {
    for (const d of domainCandidates) {
      const domainAttr = d ? `; domain=${d}` : "";

      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
    }
  }
};
