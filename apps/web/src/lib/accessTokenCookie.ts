import { env } from "@/config/env";

/** 로그인 콜백(app/login/oauth/success/route.ts)이 저장하는 토큰 쿠키 수명과 같음 */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** 만료 직전 토큰으로 보낸 요청이 가는 도중 만료되지 않도록 이 시간 안에 만료되면 만료로 봄 */
const EXPIRY_SKEW_SECONDS = 30;

/**
 * 토큰 쿠키 속성을 돌려줌
 * 로그인 콜백과 같아야 브라우저가 같은 쿠키로 보고 덮어씀
 * @returns path·maxAge·secure·sameSite와 설정된 경우 domain
 */
export const getAccessTokenCookieOptions = () => ({
  path: "/",
  maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  // 로컬(http://localhost)에서는 브라우저가 Secure 쿠키를 저장하지 않으므로 뺌 (GLB-202)
  secure: !env.IS_LOCAL_DEV,
  sameSite: "lax" as const,
  ...(!env.IS_LOCAL_DEV && env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

/**
 * 응답의 access token에서 "Bearer " 접두어를 뗌
 * @param token - 백엔드가 준 토큰
 * @returns 쿠키에 저장하는 형식의 토큰
 */
export const stripBearer = (token: string) => (token.startsWith("Bearer ") ? token.slice("Bearer ".length) : token);

/**
 * JWT의 만료 시각을 읽음
 * 서명은 검증하지 않으며 재발급 시점을 정하는 데만 씀
 * @param token - 쿠키에 저장된 access token
 * @returns 만료 시각(초), 읽을 수 없으면 null
 */
export const getAccessTokenExpiry = (token: string): number | null => {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { exp?: unknown };
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
};

/**
 * access token이 만료됐거나 곧 만료되는지 확인함
 * @param token - 쿠키에 저장된 access token
 * @param nowMs - 현재 시각(ms), 테스트에서 바꿔 넣음
 * @returns 만료 시각을 읽을 수 있고 그 시각이 지났거나 곧 지나면 true
 */
export const isAccessTokenExpired = (token: string, nowMs: number = Date.now()): boolean => {
  const exp = getAccessTokenExpiry(token);
  return exp !== null && exp - EXPIRY_SKEW_SECONDS <= nowMs / 1000;
};
