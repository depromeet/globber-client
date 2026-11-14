import { NextResponse } from "next/server";

import { describe, expect, it } from "vitest";

import { appendSetCookies, legacyDomainExpiryCookies, serializeCookie } from "./authCookieHeaders";

const NAMES = ["kakao_access_token", "member_id", "uuid"] as const;

describe("인증 쿠키 Set-Cookie (GLB-125, GLB-202)", () => {
  it("globber.world 계열 호스트에서만 예전 도메인 쿠키 만료 헤더를 만든다", () => {
    expect(legacyDomainExpiryCookies(NAMES, "globber.world")).toHaveLength(3);
    expect(legacyDomainExpiryCookies(NAMES, "www.globber.world")).toHaveLength(3);
    expect(legacyDomainExpiryCookies(NAMES, "localhost")).toHaveLength(0);
    expect(legacyDomainExpiryCookies(NAMES, "evilglobber.world")).toHaveLength(0);
    expect(legacyDomainExpiryCookies(NAMES, "globber.world")[0]).toMatch(
      /^kakao_access_token=; Path=\/; Max-Age=0; Expires=.*; Domain=\.globber\.world; Secure; SameSite=Lax$/
    );
  });

  it("새 쿠키는 Domain 없이 Secure로 만든다", () => {
    expect(serializeCookie("uuid", "abc", { maxAge: 604800, secure: true })).toBe(
      "uuid=abc; Path=/; Max-Age=604800; Secure; SameSite=Lax"
    );
  });

  it("같은 이름의 만료 헤더와 새 쿠키 헤더가 응답에 모두 남는다", () => {
    const response = appendSetCookies(NextResponse.redirect("https://globber.world/"), [
      ...legacyDomainExpiryCookies(["uuid"], "globber.world"),
      serializeCookie("uuid", "abc", { maxAge: 604800, secure: true }),
    ]);
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("Domain=.globber.world; Secure");
    expect(setCookies[1]).toBe("uuid=abc; Path=/; Max-Age=604800; Secure; SameSite=Lax");
  });
});
