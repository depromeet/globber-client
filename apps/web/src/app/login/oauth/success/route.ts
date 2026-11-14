import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import type { LoginResult } from "@globber/shared/types/member";
import { logger } from "@globber/shared/utils/logger";

import { getOAuthOrigin, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/app/login/oauth/state";
import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { buildLoginErrorPath } from "@/constants/loginError";
import { exchangeLoginCode } from "@/services/memberService";

import { appendSetCookies, legacyDomainExpiryCookies, serializeCookie } from "./authCookieHeaders";

const AUTH_COOKIE_NAMES = [AUTH_COOKIE.ACCESS_TOKEN, AUTH_COOKIE.MEMBER_ID, AUTH_COOKIE.UUID] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const origin = getOAuthOrigin(request);

  // 로컬 개발 환경 여부 (NODE_ENV 기반)
  const isLocalDev = env.IS_LOCAL_DEV;

  // 쿠키는 읽기만 cookies()로 하고, 쓰기는 cookies().set 대신 Set-Cookie 헤더로 직접 한다.
  // cookies().set을 쓰면 Next가 응답 쿠키를 이름 기준으로 합쳐 같은 이름의 예전 쿠키 만료와 새 쿠키 중 하나가 사라진다 (authCookieHeaders 참고)
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  // 로그인 nonce는 한 번만 쓰므로 어떤 결과든 지운다
  const expireStateCookie = serializeCookie(OAUTH_STATE_COOKIE, "", {
    maxAge: 0,
    secure: OAUTH_STATE_COOKIE_OPTIONS.secure,
    httpOnly: OAUTH_STATE_COOKIE_OPTIONS.httpOnly,
  });
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const cookieAttributes = {
    // HTTPS에서만 전송한다. 로컬(http://localhost)에서는 브라우저가 Secure 쿠키를 저장하지 않으므로 뺀다 (GLB-202)
    secure: !isLocalDev,
    // COOKIE_DOMAIN이 없으면 호스트 전용 쿠키로 저장해 하위 도메인으로 보내지 않는다 (GLB-125)
    ...(isLocalDev ? {} : env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
  // 호스트 전용으로 저장할 때만 예전 도메인 쿠키를 함께 만료시킨다
  const legacyExpiry =
    !isLocalDev && !env.COOKIE_DOMAIN ? legacyDomainExpiryCookies(AUTH_COOKIE_NAMES, new URL(origin).hostname) : [];

  // 로그인에 실패하면 이전 인증 쿠키를 같은 path·domain으로 만료시킨다.
  // 남아 있으면 미들웨어가 /login을 이전 계정의 /globe/{uuid}로 돌려보내 다시 로그인할 수 없다.
  // 조용히 돌아가면 사용자가 원인을 모르므로 실패 안내를 함께 띄운다 (GLB-388)
  const redirectToLogin = () =>
    appendSetCookies(NextResponse.redirect(new URL(buildLoginErrorPath("oauth_failed"), origin)), [
      expireStateCookie,
      ...legacyExpiry,
      ...AUTH_COOKIE_NAMES.map(name => serializeCookie(name, "", { ...cookieAttributes, maxAge: 0 })),
    ]);

  if (
    !code ||
    searchParams.getAll("code").length !== 1 ||
    !expectedState ||
    searchParams.getAll("state").length !== 1 ||
    searchParams.get("state") !== expectedState
  ) {
    return redirectToLogin();
  }

  // 백엔드는 토큰을 URL에 싣지 않고 일회용 code만 넘기므로, 서버에서 code를 교환해 로그인 결과를 받는다
  let loginResult: LoginResult;
  try {
    loginResult = await exchangeLoginCode(code);
  } catch (error) {
    // 잘못되었거나 만료(60초)되었거나 이미 쓴 code는 401. 다시 로그인하도록 로그인 화면으로 보낸다
    logger.error("로그인 code 교환 중 오류:", error);
    return redirectToLogin();
  }

  // 응답에 data가 없거나 필수 값이 비어 있으면 500 대신 로그인 화면으로 보낸다
  const { accessToken, memberId, uuid, firstLogin }: Partial<LoginResult> = loginResult ?? {};
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof memberId !== "number" ||
    typeof uuid !== "string" ||
    !uuid ||
    typeof firstLogin !== "boolean"
  ) {
    logger.error("로그인 code 교환 응답에 필수 값이 없습니다.");
    return redirectToLogin();
  }

  const cleanToken = accessToken.startsWith("Bearer ") ? accessToken.substring(7) : accessToken;

  // 토큰, 멤버 ID, UUID 모두 쿠키에 저장 (예전 도메인 쿠키 만료를 먼저 보낸다)
  const loginCookies = [
    expireStateCookie,
    ...legacyExpiry,
    serializeCookie(AUTH_COOKIE.ACCESS_TOKEN, cleanToken, { ...cookieAttributes, maxAge: maxAgeSeconds }),
    serializeCookie(AUTH_COOKIE.MEMBER_ID, memberId.toString(), { ...cookieAttributes, maxAge: maxAgeSeconds }),
    serializeCookie(AUTH_COOKIE.UUID, uuid, { ...cookieAttributes, maxAge: maxAgeSeconds }),
  ];

  if (firstLogin) {
    // 신규 사용자 - 도시 선택 페이지로 이동
    return appendSetCookies(NextResponse.redirect(new URL("/nation-select", origin)), loginCookies);
  }
  // 기존 사용자 - 홈 페이지로 이동하여 여행 데이터 확인 후 라우팅
  return appendSetCookies(NextResponse.redirect(new URL("/", origin)), loginCookies);
}
