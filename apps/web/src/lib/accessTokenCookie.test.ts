import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({ env: { IS_LOCAL_DEV: false, COOKIE_DOMAIN: undefined } }));

import { getAccessTokenExpiry, isAccessTokenExpired, stripBearer } from "./accessTokenCookie";

/** payload만 의미 있는 테스트용 JWT를 만듦 */
const makeToken = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.signature`;

describe("access token 만료 판단 (GLB-201)", () => {
  const NOW_MS = 1_800_000_000_000;
  const nowSec = NOW_MS / 1000;

  it("JWT의 exp를 읽는다", () => {
    expect(getAccessTokenExpiry(makeToken({ sub: "a", exp: 123 }))).toBe(123);
  });

  it("만료됐거나 30초 안에 만료되면 만료로 본다", () => {
    expect(isAccessTokenExpired(makeToken({ exp: nowSec - 1 }), NOW_MS)).toBe(true);
    expect(isAccessTokenExpired(makeToken({ exp: nowSec + 10 }), NOW_MS)).toBe(true);
    expect(isAccessTokenExpired(makeToken({ exp: nowSec + 3600 }), NOW_MS)).toBe(false);
  });

  it("exp를 읽을 수 없는 토큰은 만료로 보지 않는다", () => {
    expect(isAccessTokenExpired("not-a-jwt", NOW_MS)).toBe(false);
    expect(isAccessTokenExpired("a.###.c", NOW_MS)).toBe(false);
    expect(isAccessTokenExpired(makeToken({ sub: "a" }), NOW_MS)).toBe(false);
  });

  it("Bearer 접두어를 뗀다", () => {
    expect(stripBearer("Bearer abc")).toBe("abc");
    expect(stripBearer("abc")).toBe("abc");
  });
});
