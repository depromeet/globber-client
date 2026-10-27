import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isMaintenanceMode, MAINTENANCE_BYPASS_PATHS, MAINTENANCE_PATH } from "@/constants/maintenance";

const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/login/oauth/success",
  MAINTENANCE_PATH,
  "/error",
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
];

const AUTH_REQUIRED_BUT_ALLOW_ROUTING: readonly string[] = [
  "/", // 홈 페이지에서 여행 데이터 확인 후 라우팅
];

const GLOBE_SHARED_PREFIX = "/globe/";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

function allowRouting(pathname: string): boolean {
  return AUTH_REQUIRED_BUT_ALLOW_ROUTING.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

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

  const token = request.cookies.get("kakao_access_token")?.value;
  const memberId = request.cookies.get("member_id")?.value;
  const uuid = request.cookies.get("uuid")?.value;

  // 공유 링크로 접근한 경우 (/globe/[uuid] 형태) - 인증 없이 허용
  if (pathname.startsWith(GLOBE_SHARED_PREFIX) && pathname.length > GLOBE_SHARED_PREFIX.length) {
    const sharedUuid = pathname.slice(GLOBE_SHARED_PREFIX.length); // "/globe/" 이후의 uuid 추출
    console.log(`[Middleware] Allowing shared globe access with UUID: ${sharedUuid}`);
    return NextResponse.next();
  }

  if (token && pathname === "/login") {
    console.log(
      `[Middleware] Redirecting authenticated user from /login to /globe (Token: exists, MemberID: ${
        memberId || "none"
      }, UUID: ${uuid || "none"})`
    );
    const url = request.nextUrl.clone();
    url.pathname = `/globe/${uuid}`;
    return NextResponse.redirect(url);
  }

  if (!token && !isPublicPath(pathname)) {
    console.log(`[Middleware] Redirecting unauthenticated user from ${pathname} to /login`);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 토큰이 있고 라우팅이 허용된 경로면 통과 (여행 데이터 확인 후 라우팅)
  if (token && allowRouting(pathname)) {
    console.log(
      `[Middleware] Allowing routing logic for ${pathname} (Token: exists, MemberID: ${
        memberId || "none"
      }, UUID: ${uuid || "none"})`
    );
    return NextResponse.next();
  }

  console.log(
    `[Middleware] Allowing access to ${pathname} (Token: ${
      token ? "exists" : "none"
    }, MemberID: ${memberId || "none"}, UUID: ${uuid || "none"})`
  );
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
