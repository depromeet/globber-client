import { NextRequest } from "next/server";

import { beforeEach, expect, it, vi } from "vitest";

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
  expect(writes).toContainEqual(
    expect.objectContaining({
      name: "__Host-oauth_login_state",
      value: "",
      options: expect.objectContaining({ maxAge: 0, httpOnly: true, secure: true, path: "/" }),
    })
  );
});

it("이미 소비한 브라우저 nonce로는 새 code도 교환할 수 없다", async () => {
  values.set("__Host-oauth_login_state", "expected");
  await callback(new NextRequest("https://globber.world/login/oauth/success?code=first&state=expected"));
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
    expect(values.has("__Host-oauth_login_state")).toBe(false);
    for (const name of ["kakao_access_token", "member_id", "uuid"]) {
      expect(writes).toContainEqual(
        expect.objectContaining({ name, value: "", options: expect.objectContaining({ maxAge: 0 }) })
      );
    }
  } finally {
    log.mockRestore();
  }
});
