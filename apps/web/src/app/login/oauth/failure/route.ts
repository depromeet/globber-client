import { type NextRequest, NextResponse } from "next/server";

import { getOAuthOrigin, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/app/login/oauth/state";
import { LOGIN_ERROR_PARAM, type LoginErrorCode } from "@/constants/loginError";

import { serializeCookie } from "../success/authCookieHeaders";

// 카카오 동의 취소 등 OAuth 로그인이 실패하면 백엔드(oauthFailureHandler)가 이 주소로 보낸다.
// 경로가 없으면 404에 남으므로, 로그인 화면으로 보내며 실패 안내를 띄운다 (GLB-387)
const OAUTH_FAILED: LoginErrorCode = "oauth_failed";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", getOAuthOrigin(request));
  loginUrl.searchParams.set(LOGIN_ERROR_PARAM, OAUTH_FAILED);

  const response = NextResponse.redirect(loginUrl);
  // 쓰지 못한 로그인 nonce는 다시 쓸 일이 없으므로 지운다. 다음 로그인 시작 때 새로 발급된다
  response.headers.append(
    "Set-Cookie",
    serializeCookie(OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      secure: OAUTH_STATE_COOKIE_OPTIONS.secure,
      httpOnly: OAUTH_STATE_COOKIE_OPTIONS.httpOnly,
    })
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
