import { NextResponse } from "next/server";

import { describe, expect, it } from "vitest";

import { expireLegacyDomainCookies } from "./legacyCookies";

const NAMES = ["kakao_access_token", "member_id", "uuid"] as const;

describe("expireLegacyDomainCookies (GLB-125)", () => {
  it("globber.world 호스트에서는 예전 도메인 쿠키를 만료시키는 Set-Cookie를 덧붙인다", () => {
    const response = expireLegacyDomainCookies(NextResponse.redirect("https://globber.world/"), NAMES, "globber.world");
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(3);
    for (const name of NAMES) {
      expect(setCookies).toContainEqual(
        expect.stringMatching(new RegExp(`^${name}=;.*Domain=\\.globber\\.world;.*Max-Age=0`))
      );
    }
  });

  it("다른 호스트(로컬 등)에서는 아무것도 덧붙이지 않는다", () => {
    const response = expireLegacyDomainCookies(NextResponse.redirect("http://localhost:3000/"), NAMES, "localhost");
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it("evilglobber.world처럼 이름만 비슷한 호스트는 제외한다", () => {
    const response = expireLegacyDomainCookies(
      NextResponse.redirect("https://evilglobber.world/"),
      NAMES,
      "evilglobber.world"
    );
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
