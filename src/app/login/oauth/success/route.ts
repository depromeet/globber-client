import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/config/env";
import { getMemberId } from "@/services/memberService";

const ALLOWED_HOSTS = ["globber.world", "www.globber.world"];

/**
 * 프록시/로드 밸런서 환경에서 올바른 origin을 가져옵니다.
 * X-Forwarded-Host와 X-Forwarded-Proto 헤더를 우선 확인하고,
 * 없으면 환경 변수나 request.url을 사용합니다.
 */
function getOrigin(request: NextRequest): string {
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("accessToken");
  const firstLogin = searchParams.get("firstLogin");
  const uuid = searchParams.get("uuid");

  const origin = getOrigin(request);

  if (!accessToken) {
    console.error("URL에서 accessToken을 찾을 수 없습니다.");
    return NextResponse.redirect(new URL("/login", origin));
  }

  const cleanToken = accessToken.startsWith("Bearer ") ? accessToken.substring(7) : accessToken;

  // 로컬 개발 환경 여부 (NODE_ENV 기반)
  const isLocalDev = env.IS_LOCAL_DEV;

  // 서버사이드에서 쿠키 설정
  const cookieStore = await cookies();
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const cookieOptions = {
    path: "/",
    maxAge: maxAgeSeconds,
    httpOnly: false,
    ...(isLocalDev ? {} : env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
  // 이전 계정 값이 남지 않도록 같은 path·domain으로 만료시킨다
  const clearCookie = (name: string) => cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 });

  cookieStore.set("kakao_access_token", cleanToken, cookieOptions);

  try {
    // 멤버 ID 조회 API 호출
    const memberId = await getMemberId(cleanToken);
    cookieStore.set("member_id", memberId.toString(), cookieOptions);
    console.log(`멤버 ID 저장 완료: ${memberId}`);
  } catch (error) {
    // API 호출 실패 시에도 토큰은 저장하고 진행
    console.error("멤버 ID 조회 중 오류:", error);
    clearCookie("member_id");
  }

  if (uuid) {
    cookieStore.set("uuid", uuid, cookieOptions);
  } else {
    clearCookie("uuid");
  }

  if (firstLogin === "true") {
    // 신규 사용자 - 도시 선택 페이지로 이동
    return NextResponse.redirect(new URL("/nation-select", origin));
  }
  // 기존 사용자 - 홈 페이지로 이동하여 여행 데이터 확인 후 라우팅
  return NextResponse.redirect(new URL("/", origin));
}
