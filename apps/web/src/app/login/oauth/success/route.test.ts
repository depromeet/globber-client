import { NextRequest } from "next/server";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { GET } from "./route";

const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));

vi.mock("@/config/env", () => ({ env: { IS_LOCAL_DEV: false, API_BASE_URL: "https://api.example.test" } }));
vi.mock("@/services/memberService", () => ({ exchangeLoginCode: exchange }));

beforeEach(() => {
  exchange.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const FAILED = "https://globber.world/login?error=oauth_failed";

it("code가 없으면 교환하지 않고 실패 안내와 함께 로그인으로 보낸다 (GLB-388)", async () => {
  const response = await GET(new NextRequest("https://globber.world/login/oauth/success"));
  expect(response.headers.get("location")).toBe(FAILED);
  expect(exchange).not.toHaveBeenCalled();
});

it("code 교환에 실패하거나 필수 값이 없으면 실패 안내와 함께 로그인으로 보내고 인증 쿠키를 지운다 (GLB-388)", async () => {
  exchange.mockRejectedValueOnce(new Error("만료된 code"));
  const rejected = await GET(new NextRequest("https://globber.world/login/oauth/success?code=expired"));
  expect(rejected.headers.get("location")).toBe(FAILED);

  exchange.mockResolvedValueOnce({ accessToken: "", memberId: 1, uuid: "member", firstLogin: false });
  const missing = await GET(new NextRequest("https://globber.world/login/oauth/success?code=valid"));
  expect(missing.headers.get("location")).toBe(FAILED);
  const expired = missing.headers
    .getSetCookie()
    .filter(line => line.includes("Max-Age=0") && !line.includes("Domain="));
  expect(expired.map(line => line.slice(0, line.indexOf("=")))).toEqual(["kakao_access_token", "member_id", "uuid"]);
});

it("교환에 성공하면 기존처럼 홈으로 보낸다", async () => {
  exchange.mockResolvedValueOnce({ accessToken: "token", memberId: 1, uuid: "member", firstLogin: false });
  const response = await GET(new NextRequest("https://globber.world/login/oauth/success?code=valid"));
  expect(response.headers.get("location")).toBe("https://globber.world/");
});

it("실패하면 경로마다 예전 도메인 쿠키와 호스트 전용 인증 쿠키를 모두 만료시킨다", async () => {
  exchange.mockRejectedValueOnce(new Error("만료된 code"));
  const responses = [
    await GET(new NextRequest("https://globber.world/login/oauth/success")),
    await GET(new NextRequest("https://globber.world/login/oauth/success?code=expired")),
  ];
  for (const response of responses) {
    const lines = response.headers.getSetCookie();
    for (const name of ["kakao_access_token", "member_id", "uuid"]) {
      const expired = lines.filter(line => line.startsWith(`${name}=;`) && line.includes("Max-Age=0"));
      // 예전 Domain=.globber.world 쿠키 만료 1개 + 호스트 전용 만료 1개
      expect(expired).toHaveLength(2);
      for (const line of expired) expect(line).toMatch(/Path=\/.*Secure; SameSite=Lax$/);
    }
  }
});

it("교환에 성공하면 받은 code로 교환하고 신규 사용자는 도시 선택으로 보낸다", async () => {
  exchange.mockResolvedValueOnce({ accessToken: "token", memberId: 1, uuid: "member", firstLogin: true });
  const response = await GET(new NextRequest("https://globber.world/login/oauth/success?code=valid"));
  expect(exchange).toHaveBeenCalledExactlyOnceWith("valid");
  expect(response.headers.get("location")).toBe("https://globber.world/nation-select");
  const tokenCookie = response.headers.getSetCookie().find(line => line.startsWith("kakao_access_token=token"));
  expect(tokenCookie).toMatch(/Max-Age=604800; Secure; SameSite=Lax$/);
});
