import type { NextResponse } from "next/server";

// 예전에는 운영 인증 쿠키를 Domain=.globber.world로 저장해 dev 등 모든 하위 도메인에 전송됐다.
// 이제 호스트 전용으로 저장하는데, 예전 쿠키가 남으면 같은 이름의 쿠키가 두 개가 되고 오래된 쪽이 먼저 읽힐 수 있다.
// 그래서 로그인 처리 때 예전 도메인 쿠키를 함께 만료시킨다 (GLB-125)
export const LEGACY_COOKIE_DOMAIN = ".globber.world";

const isGlobberHost = (hostname: string) => hostname === "globber.world" || hostname.endsWith(".globber.world");

/**
 * 예전 도메인(.globber.world)으로 저장된 인증 쿠키를 만료시키는 Set-Cookie를 응답에 덧붙입니다.
 * 새로 저장하는 호스트 전용 쿠키와 도메인이 달라 서로 덮어쓰지 않습니다.
 */
export const expireLegacyDomainCookies = (
  response: NextResponse,
  cookieNames: readonly string[],
  hostname: string
): NextResponse => {
  if (!isGlobberHost(hostname)) return response;
  cookieNames.forEach(name =>
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Domain=${LEGACY_COOKIE_DOMAIN}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure`
    )
  );
  return response;
};
