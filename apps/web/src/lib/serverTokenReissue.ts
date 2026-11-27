import { logger } from "@globber/shared/utils/logger";

import { env } from "@/config/env";
import { stripBearer } from "@/lib/accessTokenCookie";

/** 만료된 access token과 RefreshToken 쿠키로 새 access token을 받는 백엔드 경로 */
export const REISSUE_ENDPOINT = "/api/v1/auth/reissue";

/** 백엔드가 RefreshToken을 넣어 두는 httpOnly 쿠키 이름 */
export const REFRESH_TOKEN_COOKIE = "RefreshToken";

/** 미들웨어는 화면 응답 전에 실행되므로 브라우저 요청보다 짧게 끊음 */
const SERVER_REISSUE_TIMEOUT_MS = 5_000;

type ServerReissueResult = {
  accessToken: string;
  /** 백엔드가 만료 시각을 늘려 다시 내려준 RefreshToken 쿠키 (브라우저에 그대로 전달) */
  refreshSetCookie: string | null;
};

/**
 * 서버(미들웨어)에서 요청에 실린 RefreshToken 쿠키로 access token을 재발급함 (GLB-201)
 * 브라우저 요청 재발급(lib/tokenReissue.ts)과 같은 백엔드 경로를 씀
 * @param expiredToken - 만료됐거나 곧 만료될 access token
 * @param refreshToken - 요청 쿠키의 RefreshToken 값
 * @returns 새 토큰과 RefreshToken Set-Cookie, 실패하면 null
 */
export const reissueAccessTokenOnServer = async (
  expiredToken: string,
  refreshToken: string
): Promise<ServerReissueResult | null> => {
  try {
    const response = await fetch(`${env.API_BASE_URL}${REISSUE_ENDPOINT}`, {
      method: "POST",
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${expiredToken}`,
        Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SERVER_REISSUE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { data?: { accessToken?: unknown } } | null;
    const accessToken = body?.data?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) return null;

    const refreshSetCookie =
      response.headers.getSetCookie().find(cookie => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`)) ?? null;
    return { accessToken: stripBearer(accessToken), refreshSetCookie };
  } catch (error) {
    logger.warn("서버 토큰 재발급 실패:", error);
    return null;
  }
};
