import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiDelete,
  ApiError,
  apiGet,
  apiPatch,
  apiPost,
  apiPostWithHeaders,
  apiPut,
  INVALID_RESPONSE_STATUS,
} from "./apiClient";

vi.mock("@/config/env", () => ({ env: { API_BASE_URL: "https://api.example.test", IS_LOCAL_DEV: false } }));

const mutations = [apiPost, apiPostWithHeaders, apiPut, apiPatch, apiDelete];

afterEach(() => vi.unstubAllGlobals());

describe.each(mutations.map(request => ({ name: request.name, request })))("변경 요청 $name", ({ request }) => {
  it.each([401, 500])("%i 오류는 전역 오류 화면으로 이동하고 원래 API 오류를 보존한다", async status => {
    const location = { href: "/profile" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", async () => new Response("failed", { status }));
    await expect(request("/resource")).rejects.toMatchObject({ name: "ApiError", status, endpoint: "/resource" });
    expect(location.href).toBe(`/error?type=${status}`);
  });

  it("명시적인 오류 처리 생략 옵션을 존중한다", async () => {
    const location = { href: "/profile" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    await expect(request("/api/v1/auth/logout", {}, "token", { skipGlobalErrorHandling: true })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(location.href).toBe("/profile");
  });

  it.each([500, 503, 408])("서버 오류 화면 생략 옵션이면 %i 오류에도 화면을 유지한다", async status => {
    const location = { href: "/profile" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", async () => new Response(null, { status }));
    await expect(request("/resource", {}, "token", { skipServerErrorRedirect: true })).rejects.toMatchObject({
      status,
    });
    expect(location.href).toBe("/profile");
  });

  it("서버 오류 화면 생략 옵션이어도 401은 로그인 만료 화면으로 이동한다", async () => {
    const location = { href: "/profile" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    await expect(request("/resource", {}, "token", { skipServerErrorRedirect: true })).rejects.toBeInstanceOf(ApiError);
    expect(location.href).toBe("/error?type=401");
  });

  it("서버에서는 브라우저 없이 API 오류를 반환한다", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    await expect(request("/resource")).rejects.toMatchObject({ status: 500, endpoint: "/resource" });
  });
});

it("GET의 기존 오류 처리 생략 옵션을 유지한다", async () => {
  const location = { href: "/profile" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
  await expect(apiGet("/resource", undefined, undefined, { skipGlobalErrorHandling: true })).rejects.toBeInstanceOf(
    ApiError
  );
  expect(location.href).toBe("/profile");
});

describe("응답 본문 파싱 (GLB-238)", () => {
  const mockFetchResponse = (body: string | null, init: ResponseInit) => {
    vi.stubGlobal("fetch", async () => new Response(body, init));
  };

  it("성공 응답의 JSON 본문을 그대로 돌려줌", async () => {
    mockFetchResponse(JSON.stringify({ status: "success", data: { id: 1 } }), { status: 200 });

    await expect(apiGet("/api/v1/test")).resolves.toEqual({ status: "success", data: { id: 1 } });
  });

  it("204 응답과 빈 본문은 undefined를 돌려줌", async () => {
    mockFetchResponse(null, { status: 204 });
    await expect(apiGet("/api/v1/test")).resolves.toBeUndefined();

    mockFetchResponse("", { status: 200 });
    await expect(apiGet("/api/v1/test")).resolves.toBeUndefined();
  });

  it("GET 성공 응답의 본문이 HTML이면 SyntaxError 대신 502 ApiError를 던짐", async () => {
    mockFetchResponse("<!DOCTYPE html><html>점검 중</html>", { status: 200 });

    const error = await apiGet("/api/v1/test").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: INVALID_RESPONSE_STATUS, endpoint: "/api/v1/test" });
  });

  it("POST 성공 응답의 본문이 JSON이 아니어도 502 ApiError를 던짐", async () => {
    mockFetchResponse("not json", { status: 201 });

    const error = await apiPost("/api/v1/test", { name: "test" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: INVALID_RESPONSE_STATUS, endpoint: "/api/v1/test" });
  });
});

describe("401 응답의 토큰 재발급 (GLB-201)", () => {
  const REISSUE_URL = "https://api.example.test/api/v1/auth/reissue";

  /**
   * 재발급 경로와 일반 요청을 나눠 응답하는 fetch 대역
   * 받은 요청은 calls에 남김
   */
  const stubFetch = (reissue: () => Response) => {
    const calls: { url: string; authorization?: string; credentials?: RequestCredentials }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string> | undefined)?.Authorization;
      calls.push({ url, authorization, credentials: init.credentials });
      if (url === REISSUE_URL) return reissue();
      return authorization === "Bearer new-token"
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(null, { status: 401 });
    });
    return calls;
  };

  const stubBrowser = () => {
    const location = { href: "/profile" };
    const fakeDocument = { cookie: "" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("document", fakeDocument);
    return { location, fakeDocument };
  };

  it("재발급에 성공하면 새 토큰을 쿠키에 저장하고 원래 요청을 새 토큰으로 다시 보낸다", async () => {
    const { location, fakeDocument } = stubBrowser();
    const calls = stubFetch(
      () => new Response(JSON.stringify({ data: { accessToken: "Bearer new-token" } }), { status: 200 })
    );

    await expect(apiGet("/resource", undefined, "old-token")).resolves.toEqual({ ok: true });

    expect(calls.map(call => [call.url, call.authorization])).toEqual([
      ["https://api.example.test/resource", "Bearer old-token"],
      [REISSUE_URL, "Bearer old-token"],
      ["https://api.example.test/resource", "Bearer new-token"],
    ]);
    expect(calls[1]?.credentials).toBe("include");
    expect(fakeDocument.cookie).toContain("kakao_access_token=new-token");
    expect(fakeDocument.cookie).toContain("Secure");
    expect(location.href).toBe("/profile");
  });

  it("재발급에 실패하면 지금처럼 로그인 만료 화면으로 보낸다", async () => {
    const { location, fakeDocument } = stubBrowser();
    stubFetch(() => new Response(null, { status: 401 }));

    await expect(apiPost("/resource", {}, "old-token")).rejects.toMatchObject({ status: 401 });
    expect(location.href).toBe("/error?type=401");
    expect(fakeDocument.cookie).toBe("");
  });

  it("동시에 401을 받은 요청들은 재발급을 한 번만 보낸다", async () => {
    stubBrowser();
    const calls = stubFetch(
      () => new Response(JSON.stringify({ data: { accessToken: "Bearer new-token" } }), { status: 200 })
    );

    await Promise.all([apiGet("/a", undefined, "old-token"), apiDelete("/b", undefined, "old-token")]);

    expect(calls.filter(call => call.url === REISSUE_URL)).toHaveLength(1);
  });

  it("토큰 없이 보낸 요청과 서버 요청은 재발급하지 않는다", async () => {
    const calls = stubFetch(() => new Response(null, { status: 200 }));
    await expect(apiGet("/resource", undefined, "old-token")).rejects.toMatchObject({ status: 401 });

    stubBrowser();
    await expect(apiGet("/resource")).rejects.toMatchObject({ status: 401 });

    expect(calls.some(call => call.url === REISSUE_URL)).toBe(false);
  });
});

describe("재발급 예외와 이미 바뀐 토큰 (GLB-201)", () => {
  const REISSUE_URL = "https://api.example.test/api/v1/auth/reissue";

  it("skipReissue 요청(로그아웃·탈퇴)은 401이어도 재발급하지 않는다", async () => {
    vi.stubGlobal("window", { location: { href: "/profile" } });
    vi.stubGlobal("document", { cookie: "" });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response(null, { status: 401 });
    });

    await expect(
      apiPost("/api/v1/auth/logout", {}, "old-token", { skipGlobalErrorHandling: true, skipReissue: true })
    ).rejects.toMatchObject({ status: 401 });
    expect(calls).not.toContain(REISSUE_URL);
  });

  it("다른 요청이 이미 재발급해 쿠키 토큰이 바뀌었으면 재발급 없이 그 토큰으로 다시 보낸다", async () => {
    vi.stubGlobal("window", { location: { href: "/profile" } });
    vi.stubGlobal("document", { cookie: "kakao_access_token=new-token" });
    const calls: { url: string; authorization?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string> | undefined)?.Authorization;
      calls.push({ url, authorization });
      return authorization === "Bearer new-token"
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(null, { status: 401 });
    });

    await expect(apiGet("/resource", undefined, "old-token")).resolves.toEqual({ ok: true });
    expect(calls.map(call => call.url)).not.toContain(REISSUE_URL);
    expect(calls.at(-1)?.authorization).toBe("Bearer new-token");
  });
});
