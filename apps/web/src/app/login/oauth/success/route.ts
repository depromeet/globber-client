import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import type { LoginResult } from "@globber/shared/types/member";

import { getOAuthOrigin, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/app/login/oauth/state";
import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { exchangeLoginCode } from "@/services/memberService";

const AUTH_COOKIE_NAMES = [AUTH_COOKIE.ACCESS_TOKEN, AUTH_COOKIE.MEMBER_ID, AUTH_COOKIE.UUID] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const origin = getOAuthOrigin(request);

  // 로컬 개발 환경 여부 (NODE_ENV 기반)
  const isLocalDev = env.IS_LOCAL_DEV;

  // 서버사이드에서 쿠키 설정
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.set(OAUTH_STATE_COOKIE, "", { ...OAUTH_STATE_COOKIE_OPTIONS, maxAge: 0 });
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const cookieOptions = {
    path: "/",
    maxAge: maxAgeSeconds,
    httpOnly: false,
    ...(isLocalDev ? {} : env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };

  // 로그인에 실패하면 이전 인증 쿠키를 같은 path·domain으로 만료시킨다.
  // 남아 있으면 미들웨어가 /login을 이전 계정의 /globe/{uuid}로 돌려보내 다시 로그인할 수 없다.
  const redirectToLogin = () => {
    AUTH_COOKIE_NAMES.forEach(name => cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 }));
    return NextResponse.redirect(new URL("/login", origin));
  };

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
    console.error("로그인 code 교환 중 오류:", error);
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
    console.error("로그인 code 교환 응답에 필수 값이 없습니다.");
    return redirectToLogin();
  }

  const cleanToken = accessToken.startsWith("Bearer ") ? accessToken.substring(7) : accessToken;

  // 토큰, 멤버 ID, UUID 모두 쿠키에 저장
  cookieStore.set(AUTH_COOKIE.ACCESS_TOKEN, cleanToken, cookieOptions);
  cookieStore.set(AUTH_COOKIE.MEMBER_ID, memberId.toString(), cookieOptions);
  cookieStore.set(AUTH_COOKIE.UUID, uuid, cookieOptions);

  if (firstLogin) {
    // 신규 사용자 - 도시 선택 페이지로 이동
    return NextResponse.redirect(new URL("/nation-select", origin));
  }
  // 기존 사용자 - 홈 페이지로 이동하여 여행 데이터 확인 후 라우팅
  return NextResponse.redirect(new URL("/", origin));
}
