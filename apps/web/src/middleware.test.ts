import { NextRequest } from "next/server";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: { API_BASE_URL: "https://api.example.test", IS_LOCAL_DEV: false, COOKIE_DOMAIN: undefined },
}));

import { middleware } from "./middleware";

const makeToken = (expSec: number) =>
  `header.${btoa(JSON.stringify({ sub: "a", exp: expSec }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}.signature`;

const nowSec = () => Math.floor(Date.now() / 1000);

const makeRequest = (path: string, cookies: Record<string, string>) =>
  new NextRequest(`https://globber.world${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe("미들웨어의 만료 토큰 재발급 (GLB-201)", () => {
  it("만료된 토큰이면 RefreshToken으로 재발급해 응답과 이번 요청 쿠키에 새 토큰을 넣는다", async () => {
    const expired = makeToken(nowSec() - 60);
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { accessToken: "Bearer new-token" } }), {
          status: 200,
          headers: { "Set-Cookie": "RefreshToken=refresh; Path=/; Max-Age=1209600; HttpOnly; Secure; SameSite=Lax" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await middleware(
      makeRequest("/profile", { kakao_access_token: expired, uuid: "W0kTg5", RefreshToken: "refresh" })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/auth/reissue");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${expired}`, Cookie: "RefreshToken=refresh" });

    expect(response.cookies.get("kakao_access_token")?.value).toBe("new-token");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("kakao_access_token=new-token");
    expect(response.headers.get("set-cookie")).toContain("RefreshToken=refresh");
  });

  it("아직 유효한 토큰이면 재발급하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await middleware(
      makeRequest("/profile", { kakao_access_token: makeToken(nowSec() + 3600), RefreshToken: "refresh" })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get("kakao_access_token")).toBeUndefined();
  });

  it("RefreshToken이 없거나 재발급에 실패하면 지금처럼 그대로 통과시킨다", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const expired = makeToken(nowSec() - 60);

    const withoutRefresh = await middleware(makeRequest("/profile", { kakao_access_token: expired }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(withoutRefresh.cookies.get("kakao_access_token")).toBeUndefined();

    const failed = await middleware(makeRequest("/profile", { kakao_access_token: expired, RefreshToken: "bad" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(failed.cookies.get("kakao_access_token")).toBeUndefined();
    expect(failed.headers.get("location")).toBeNull();
  });

  it("정적 파일 같은 공개 경로는 재발급하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await middleware(
      makeRequest("/assets/thumbnail.webp", { kakao_access_token: makeToken(nowSec() - 60), RefreshToken: "refresh" })
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
