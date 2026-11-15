import type { NextResponse } from "next/server";

// 예전에는 운영 인증 쿠키를 Domain=.globber.world로 저장해 dev 등 모든 하위 도메인에 전송됐다.
// 이제 호스트 전용으로 저장하는데, 예전 쿠키가 남으면 같은 이름의 쿠키가 두 개가 되므로 로그인 처리 때 함께 만료시킨다 (GLB-125)
export const LEGACY_COOKIE_DOMAIN = ".globber.world";

const EXPIRED_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

type CookieAttributes = {
  maxAge: number;
  secure: boolean;
  domain?: string;
  httpOnly?: boolean;
};

/** Set-Cookie 헤더 한 줄을 만든다. 값 인코딩은 Next의 cookies().set과 같게 encodeURIComponent를 쓴다 */
export const serializeCookie = (name: string, value: string, { maxAge, secure, domain, httpOnly }: CookieAttributes) =>
  [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    maxAge === 0 ? `Expires=${EXPIRED_DATE}` : null,
    domain ? `Domain=${domain}` : null,
    secure ? "Secure" : null,
    httpOnly ? "HttpOnly" : null,
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");

const isGlobberHost = (hostname: string) => hostname === "globber.world" || hostname.endsWith(".globber.world");

/** 예전 도메인(.globber.world)으로 저장된 인증 쿠키를 만료시키는 Set-Cookie 목록. globber.world 계열 호스트에서만 만든다 */
export const legacyDomainExpiryCookies = (cookieNames: readonly string[], hostname: string): string[] =>
  isGlobberHost(hostname)
    ? cookieNames.map(name => serializeCookie(name, "", { maxAge: 0, secure: true, domain: LEGACY_COOKIE_DOMAIN }))
    : [];

/**
 * Set-Cookie 헤더를 응답에 그대로 덧붙인다.
 * 이 라우트에서 cookies().set을 함께 쓰면 Next가 응답 쿠키를 이름 기준으로 하나만 남기도록 합쳐서,
 * 같은 이름인 "예전 도메인 쿠키 만료"와 "새 쿠키 저장" 중 하나가 사라진다. 그래서 인증 쿠키는 모두 이 함수로만 쓴다.
 */
export const appendSetCookies = (response: NextResponse, setCookies: readonly string[]): NextResponse => {
  setCookies.forEach(cookie => response.headers.append("Set-Cookie", cookie));
  return response;
};
