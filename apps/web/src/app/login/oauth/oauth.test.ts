import { NextRequest } from "next/server";

import { beforeEach, expect, it, vi } from "vitest";

import { GET as failure } from "./failure/route";
import { GET as start } from "./start/route";
import { GET as callback } from "./success/route";

const { values, writes, exchange, config } = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as { name: string; value: string; options: Record<string, unknown> }[],
  exchange: vi.fn(),
  config: { IS_LOCAL_DEV: false, API_BASE_URL: "https://api.example.test" },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (values.has(name) ? { value: values.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      writes.push({ name, value, options });
      if (options.maxAge === 0) values.delete(name);
      else values.set(name, value);
    },
  }),
}));
vi.mock("@/config/env", () => ({ env: config }));
vi.mock("@/services/memberService", () => ({ exchangeLoginCode: exchange }));

// 콜백은 쿠키를 cookies().set이 아니라 응답의 Set-Cookie 헤더로 쓴다(GLB-125). 브라우저처럼 헤더를 쿠키 저장소에 반영한다
const applySetCookies = (response: Response) => {
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split("; ");
    const name = pair.slice(0, pair.indexOf("="));
    const value = decodeURIComponent(pair.slice(pair.indexOf("=") + 1));
    if (attributes.some(attribute => attribute.startsWith("Domain="))) continue; // 다른 도메인 쿠키는 이 호스트 저장소와 별개
    if (attributes.includes("Max-Age=0")) values.delete(name);
    else values.set(name, value);
  }
};

const setCookieFor = (response: Response, name: string) =>
  response.headers.getSetCookie().filter(line => line.startsWith(`${name}=`) && !line.includes("Domain="));

beforeEach(() => {
  values.clear();
  config.API_BASE_URL = "https://api.example.test";
  writes.length = 0;
  exchange.mockReset();
  exchange.mockResolvedValue({ accessToken: "token", memberId: 1, uuid: "member", firstLogin: false });
});

it("상대 API 주소를 쓰는 프록시 환경에서도 로그인 시작 주소를 만든다", async () => {
  config.API_BASE_URL = "/api";
  const response = await start(new NextRequest("https://globber.world/login/oauth/start"));
  const authorization = new URL(response.headers.get("location")!);
  expect(authorization.origin + authorization.pathname).toBe("https://globber.world/api/oauth2/authorization/kakao");
});

it("로그인 시작마다 새 HttpOnly nonce를 저장하고 백엔드의 콜백 주소에 묶는다", async () => {
  const first = await start(new NextRequest("https://globber.world/login/oauth/start"));
  const second = await start(new NextRequest("https://globber.world/login/oauth/start"));
  const authorization = new URL(first.headers.get("location")!);
  expect(authorization.origin + authorization.pathname).toBe("https://api.example.test/oauth2/authorization/kakao");
  const callbackUrl = new URL(authorization.searchParams.get("redirect_uri")!);
  expect(callbackUrl.origin + callbackUrl.pathname).toBe("https://globber.world/login/oauth/success");
  expect(callbackUrl.searchParams.get("state")).toBe(writes[0].value);
  expect(writes[0].value).toHaveLength(64);
  expect(writes[0].value).not.toBe(writes[1].value);
  expect(writes[0].name).toBe("__Host-oauth_login_state");
  expect(writes[0].options).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  expect(writes[0].options).not.toHaveProperty("domain");
  expect(second.headers.get("cache-control")).toBe("no-store");
});

it.each(["code=valid", "code=valid&state=expected&state=other", "code=valid&code=other&state=expected"])(
  "모호하거나 nonce가 없는 콜백은 거부한다 (%s)",
  async query => {
    values.set("__Host-oauth_login_state", "expected");
    const response = await callback(new NextRequest(`https://globber.world/login/oauth/success?${query}`));
    expect(response.headers.get("location")).toBe("https://globber.world/login");
    expect(exchange).not.toHaveBeenCalled();
  }
);

it.each([undefined, "wrong"])("브라우저 nonce가 없거나 다른 콜백은 code를 교환하지 않는다 (%s)", async cookie => {
  if (cookie) values.set("__Host-oauth_login_state", cookie);
  const response = await callback(
    new NextRequest("https://globber.world/login/oauth/success?code=attacker&state=expected")
  );
  expect(response.headers.get("location")).toBe("https://globber.world/login");
  expect(exchange).not.toHaveBeenCalled();
});

it("같은 브라우저 nonce가 일치하면 code를 교환하고 nonce를 만료시킨다", async () => {
  values.set("__Host-oauth_login_state", "expected");
  const response = await callback(
    new NextRequest("https://globber.world/login/oauth/success?code=valid&state=expected")
  );
  expect(response.headers.get("location")).toBe("https://globber.world/");
  expect(exchange).toHaveBeenCalledExactlyOnceWith("valid");
  expect(setCookieFor(response, "__Host-oauth_login_state")).toEqual([
    expect.stringMatching(/^__Host-oauth_login_state=; Path=\/; Max-Age=0; .*Secure; HttpOnly/),
  ]);
  // 새 인증 쿠키가 예전 도메인 쿠키 만료와 함께 응답에 남아야 한다
  for (const name of ["kakao_access_token", "member_id", "uuid"]) {
    expect(setCookieFor(response, name)).toEqual([expect.stringMatching(/Max-Age=604800; Secure; SameSite=Lax$/)]);
  }
});

it("이미 소비한 브라우저 nonce로는 새 code도 교환할 수 없다", async () => {
  values.set("__Host-oauth_login_state", "expected");
  applySetCookies(
    await callback(new NextRequest("https://globber.world/login/oauth/success?code=first&state=expected"))
  );
  const replay = await callback(
    new NextRequest("https://globber.world/login/oauth/success?code=second&state=expected")
  );
  expect(replay.headers.get("location")).toBe("https://globber.world/login");
  expect(exchange).toHaveBeenCalledExactlyOnceWith("first");
});

it("code 교환 실패 시 nonce와 이전 인증 쿠키를 지우고 로그인으로 이동한다", async () => {
  values.set("__Host-oauth_login_state", "expected");
  exchange.mockRejectedValue(new Error("만료된 code"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await callback(
      new NextRequest("https://globber.world/login/oauth/success?code=expired&state=expected")
    );
    expect(response.headers.get("location")).toBe("https://globber.world/login");
    applySetCookies(response);
    expect(values.has("__Host-oauth_login_state")).toBe(false);
    for (const name of ["kakao_access_token", "member_id", "uuid"]) {
      expect(setCookieFor(response, name)).toEqual([
        expect.stringMatching(new RegExp(`^${name}=; Path=/; Max-Age=0;`)),
      ]);
    }
  } finally {
    log.mockRestore();
  }
});

it("OAuth 실패로 돌아오면 nonce를 지우고 실패 안내와 함께 로그인으로 보낸다 (GLB-387)", async () => {
  values.set("__Host-oauth_login_state", "expected");
  const response = await failure(new NextRequest("https://globber.world/login/oauth/failure"));
  expect(response.headers.get("location")).toBe("https://globber.world/login?error=oauth_failed");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(setCookieFor(response, "__Host-oauth_login_state")).toEqual([
    expect.stringMatching(/^__Host-oauth_login_state=; Path=\/; Max-Age=0; .*Secure; HttpOnly/),
  ]);
  applySetCookies(response);
  expect(values.has("__Host-oauth_login_state")).toBe(false);
  expect(exchange).not.toHaveBeenCalled();
});
