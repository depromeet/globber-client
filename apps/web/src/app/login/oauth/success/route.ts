import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import type { LoginResult } from "@globber/shared/types/member";

import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { exchangeLoginCode } from "@/services/memberService";

import { expireLegacyDomainCookies } from "./legacyCookies";

const ALLOWED_HOSTS = ["globber.world", "www.globber.world"];

/**
 * 프록시/로드 밸런서 환경에서 올바른 origin을 가져옵니다.
 * X-Forwarded-Host와 X-Forwarded-Proto 헤더를 우선 확인하고,
 * 없으면 환경 변수나 request.url을 사용합니다.
 */
const getOrigin = (request: NextRequest): string => {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost && ALLOWED_HOSTS.some(h => forwardedHost === h || forwardedHost.endsWith(`.${h}`)))
    return `${forwardedProto}://${forwardedHost}`;

  // 환경 변수가 있으면 사용
  if (env.REDIRECT_ORIGIN) {
    return env.REDIRECT_ORIGIN;
  }

  // 마지막 fallback으로 request.url 사용
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

const AUTH_COOKIE_NAMES = [AUTH_COOKIE.ACCESS_TOKEN, AUTH_COOKIE.MEMBER_ID, AUTH_COOKIE.UUID] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const origin = getOrigin(request);

  // 로컬 개발 환경 여부 (NODE_ENV 기반)
  const isLocalDev = env.IS_LOCAL_DEV;

  // 서버사이드에서 쿠키 설정
  const cookieStore = await cookies();
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const cookieOptions = {
    path: "/",
    maxAge: maxAgeSeconds,
    httpOnly: false,
    // HTTPS에서만 전송한다. 로컬(http://localhost)에서는 브라우저가 Secure 쿠키를 저장하지 않으므로 뺀다 (GLB-202)
    secure: !isLocalDev,
    // COOKIE_DOMAIN이 없으면 호스트 전용 쿠키로 저장해 하위 도메인으로 보내지 않는다 (GLB-125)
    ...(isLocalDev ? {} : env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
  // 호스트 전용으로 저장할 때만 예전 도메인 쿠키를 정리한다
  const shouldExpireLegacyCookies = !isLocalDev && !env.COOKIE_DOMAIN;
  const withLegacyCleanup = (response: NextResponse) =>
    shouldExpireLegacyCookies
      ? expireLegacyDomainCookies(response, AUTH_COOKIE_NAMES, new URL(origin).hostname)
      : response;

  // 로그인에 실패하면 이전 인증 쿠키를 같은 path·domain으로 만료시킨다.
  // 남아 있으면 미들웨어가 /login을 이전 계정의 /globe/{uuid}로 돌려보내 다시 로그인할 수 없다.
  const redirectToLogin = () => {
    AUTH_COOKIE_NAMES.forEach(name => cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 }));
    return withLegacyCleanup(NextResponse.redirect(new URL("/login", origin)));
  };

  if (!code) {
    console.error("URL에서 로그인 code를 찾을 수 없습니다.");
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
    return withLegacyCleanup(NextResponse.redirect(new URL("/nation-select", origin)));
  }
  // 기존 사용자 - 홈 페이지로 이동하여 여행 데이터 확인 후 라우팅
  return withLegacyCleanup(NextResponse.redirect(new URL("/", origin)));
}
