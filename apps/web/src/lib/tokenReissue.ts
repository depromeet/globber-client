import { logger } from "@globber/shared/utils/logger";

import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { getAccessTokenCookieOptions, stripBearer } from "@/lib/accessTokenCookie";
import { REISSUE_ENDPOINT } from "@/lib/serverTokenReissue";
import { getCookie } from "@/utils/cookies";

const REISSUE_TIMEOUT_MS = 10_000;

// 동시에 여러 요청이 401을 받아도 재발급은 한 번만 보내고 결과를 함께 씀
let pendingReissue: Promise<string | null> | null = null;

/**
 * 새 access token을 로그인 콜백과 같은 속성의 쿠키로 저장함
 * 속성이 다르면 브라우저가 다른 쿠키로 보고 같은 이름의 쿠키가 둘이 됨
 */
const saveAccessToken = (token: string) => {
  const { path, maxAge, secure, domain } = { domain: undefined, ...getAccessTokenCookieOptions() };
  const attributes = [
    `${AUTH_COOKIE.ACCESS_TOKEN}=${encodeURIComponent(token)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    domain ? `Domain=${domain}` : null,
    secure ? "Secure" : null,
    "SameSite=Lax",
  ];
  document.cookie = attributes.filter(Boolean).join("; ");
};

const requestReissue = async (expiredToken: string): Promise<string | null> => {
  try {
    const response = await fetch(`${env.API_BASE_URL}${REISSUE_ENDPOINT}`, {
      method: "POST",
      headers: { accept: "*/*", Authorization: `Bearer ${expiredToken}` },
      // RefreshToken은 백엔드가 넣은 httpOnly 쿠키라 브라우저가 함께 보내도록 함
      credentials: "include",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(REISSUE_TIMEOUT_MS) : undefined,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { data?: { accessToken?: unknown } } | null;
    const accessToken = body?.data?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) return null;

    const cleanToken = stripBearer(accessToken);
    saveAccessToken(cleanToken);
    return cleanToken;
  } catch (error) {
    logger.warn("토큰 재발급 실패:", error);
    return null;
  }
};

/**
 * access token이 만료됐을 때 새 토큰을 받아 쿠키에 저장함 (GLB-201)
 * 서버 렌더링 요청은 미들웨어(middleware.ts)가 먼저 재발급하므로 여기서는 브라우저 요청만 다룸
 * @param expiredToken - 401을 받은 요청에 쓴 토큰
 * @returns 쓸 수 있는 새 토큰, 재발급하지 못하면 null
 */
export const reissueAccessToken = (expiredToken: string): Promise<string | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(null);

  // 다른 요청이 이미 재발급해 쿠키 토큰이 바뀌었으면 다시 재발급하지 않고 그 토큰을 씀
  const currentToken = getCookie(AUTH_COOKIE.ACCESS_TOKEN);
  if (currentToken && currentToken !== expiredToken) return Promise.resolve(currentToken);

  pendingReissue ??= requestReissue(expiredToken).finally(() => {
    pendingReissue = null;
  });
  return pendingReissue;
};
