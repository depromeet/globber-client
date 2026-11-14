import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/constants/authCookies";
import { isMaintenanceMode, MAINTENANCE_BYPASS_PATHS, MAINTENANCE_PATH } from "@/constants/maintenance";

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
  "/robots.txt",
  "/sitemap.xml",
  "/public",
  "/icons",
  "/test",
  "/webhooks", // 외부 서비스(Sentry 등) 웹훅 수신 - 각 라우트에서 서명으로 검증
  "/v3/api-docs", // 개발 서버 Swagger UI가 루트로 요청하는 문서 JSON (next.config.ts rewrites로 백엔드 전달)
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

export function middleware(request: NextRequest) {
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

  const token = request.cookies.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;
  const uuid = request.cookies.get(AUTH_COOKIE.UUID)?.value;

  // 공유 링크로 접근한 경우 (/globe/[uuid] 형태) - 인증 없이 허용
  if (pathname.startsWith(GLOBE_SHARED_PREFIX) && pathname.length > GLOBE_SHARED_PREFIX.length) {
    return NextResponse.next();
  }

  // uuid 쿠키가 없으면 이동할 지구본이 없으므로 로그인 화면을 그대로 보여 준다
  if (token && uuid && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = `/globe/${uuid}`;
    return NextResponse.redirect(url);
  }

  if (!token && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 토큰이 있고 라우팅이 허용된 경로면 통과 (여행 데이터 확인 후 라우팅)
  if (token && allowRouting(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
