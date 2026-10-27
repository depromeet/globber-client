// 쿠키에서 값을 가져오는 유틸 함수 (클라이언트 전용)
export const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find(row => row.startsWith(`${name}=`))
    ?.split("=")[1];

  return value || null;
};

// 쿠키에서 토큰과 멤버 ID를 가져오는 함수 (클라이언트 전용)
export const getAuthInfo = () => {
  const token = getCookie("kakao_access_token");
  const memberId = getCookie("member_id");
  const uuid = getCookie("uuid");

  return { token, memberId, uuid };
};

/**
 * 인증 토큰을 검증하고 반환합니다.
 * 토큰이 제공되지 않으면 클라이언트 환경에서 쿠키에서 가져옵니다.
 *
 * @param token - 선택사항. 인증 토큰
 * @returns 검증된 인증 토큰
 * @throws 인증 정보가 없을 경우
 */
export const getValidatedAuthToken = (token?: string): string => {
  let authToken = token;

  // 토큰이 없을 경우, 클라이언트 환경에서만 쿠키에서 가져오기
  if (!authToken && typeof document !== "undefined") {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  return authToken;
};

/**
 * 모든 쿠키를 삭제합니다.
 * 클라이언트 전용 함수입니다.
 */
export const clearAllCookies = (): void => {
  if (typeof document === "undefined") return;

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

  // 모든 쿠키 가져오기
  const allCookies = document.cookie.split("; ");

  // 각 쿠키를 모든 도메인 후보에 대해 삭제
  for (const cookie of allCookies) {
    const cookieName = cookie.split("=")[0];
    for (const d of domainCandidates) {
      const domainAttr = d ? `; domain=${d}` : "";
      document.cookie = `${cookieName}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
    }
  }
};
