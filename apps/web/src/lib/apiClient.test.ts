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
