import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/constants/authCookies";
import { isMaintenanceMode, MAINTENANCE_BYPASS_PATHS, MAINTENANCE_PATH } from "@/constants/maintenance";
import { getAccessTokenCookieOptions, isAccessTokenExpired } from "@/lib/accessTokenCookie";
import { REFRESH_TOKEN_COOKIE, reissueAccessTokenOnServer } from "@/lib/serverTokenReissue";

const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/login/oauth/success",
  MAINTENANCE_PATH,
  "/error",
  "/terms", // 가입 전에도 약관·개인정보 처리방침을 볼 수 있어야 한다 (GLB-130)
  "/_next",
  "/api",
  "/assets",
  "/data",
  "/favicon.png",
  // 브라우저가 로그인 전에도 탭 아이콘을 요청하므로 로그인 화면으로 보내지 않음 (GLB-244)
  "/favicon.svg",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/public",
  "/icons",
  "/test",
  "/webhooks", // 외부 서비스(Sentry 등) 웹훅 수신 - 각 라우트에서 서명으로 검증
  // 개발 서버 Swagger UI가 루트로 요청하는 문서 JSON (next.config.ts rewrites로 백엔드 전달). 운영에는 rewrite가 없어 404
  "/v3/api-docs",
];

const AUTH_REQUIRED_BUT_ALLOW_ROUTING: readonly string[] = [
  "/", // 홈 페이지에서 여행 데이터 확인 후 라우팅
];

const GLOBE_SHARED_PREFIX = "/globe/";

const isPublicPath = (pathname: string): boolean => {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
};

const allowRouting = (pathname: string): boolean => {
  return AUTH_REQUIRED_BUT_ALLOW_ROUTING.some(p => pathname === p || pathname.startsWith(`${p}/`));
};

// 재시도 권장 시점(초). 복구 시점이 미정이라 1시간으로 둔다
const MAINTENANCE_RETRY_AFTER_SECONDS = "3600";

function isMaintenanceBypassPath(pathname: string): boolean {
  return MAINTENANCE_BYPASS_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

type ReissuedCookies = { accessToken: string; refreshSetCookie: string | null };

/**
 * access token이 만료됐으면 RefreshToken 쿠키로 재발급함 (GLB-201)
 * 서버 컴포넌트가 화면을 그리기 전에 실행되므로 앱을 다시 열거나 화면을 옮겨도 401 화면으로 가지 않음
 * 새 토큰은 이번 요청 쿠키에도 넣어 같은 요청의 서버 조회가 새 토큰을 쓰게 함
 */
const reissueExpiredToken = async (request: NextRequest, token: string): Promise<ReissuedCookies | null> => {
  if (!isAccessTokenExpired(token)) return null;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  const reissued = await reissueAccessTokenOnServer(token, refreshToken);
  if (!reissued) return null;

  request.cookies.set(AUTH_COOKIE.ACCESS_TOKEN, reissued.accessToken);
  return reissued;
};

/** 재발급한 토큰을 브라우저에 저장하도록 응답에 쿠키를 붙임 */
const withReissuedCookies = (response: NextResponse, reissued: ReissuedCookies | null): NextResponse => {
  if (!reissued) return response;
  response.cookies.set(AUTH_COOKIE.ACCESS_TOKEN, reissued.accessToken, getAccessTokenCookieOptions());
  if (reissued.refreshSetCookie) response.headers.append("Set-Cookie", reissued.refreshSetCookie);
  return response;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 점검 모드: 로그인·공유 링크 여부와 관계없이 모든 페이지를 점검 화면으로 대체 (URL은 유지)
  if (isMaintenanceMode() && !isMaintenanceBypassPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = MAINTENANCE_PATH;
    const response = NextResponse.rewrite(url, { status: 503 });
    response.headers.set("Retry-After", MAINTENANCE_RETRY_AFTER_SECONDS);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const currentToken = request.cookies.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;
  const uuid = request.cookies.get(AUTH_COOKIE.UUID)?.value;

  // 정적 파일 등 공개 경로는 서버 조회가 없으므로 재발급하지 않음
  const shouldReissue = currentToken && (!isPublicPath(pathname) || pathname === "/login");
  const reissued = shouldReissue ? await reissueExpiredToken(request, currentToken) : null;
  const token = reissued?.accessToken ?? currentToken;
  // 바뀐 요청 쿠키를 서버 컴포넌트까지 넘김
  const next = () => withReissuedCookies(NextResponse.next({ request: { headers: request.headers } }), reissued);

  // 공유 링크로 접근한 경우 (/globe/[uuid] 형태) - 인증 없이 허용
  if (pathname.startsWith(GLOBE_SHARED_PREFIX) && pathname.length > GLOBE_SHARED_PREFIX.length) {
    return next();
  }

  // uuid 쿠키가 없으면 이동할 지구본이 없으므로 로그인 화면을 그대로 보여 준다
  if (token && uuid && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `/globe/${uuid}`;
    return withReissuedCookies(NextResponse.redirect(url), reissued);
  }

  if (!token && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withReissuedCookies(NextResponse.redirect(url), reissued);
  }

  // 토큰이 있고 라우팅이 허용된 경로면 통과 (여행 데이터 확인 후 라우팅)
  if (token && allowRouting(pathname)) {
    return next();
  }

  return next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
