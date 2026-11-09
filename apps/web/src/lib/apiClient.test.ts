import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDelete, ApiError, apiGet, apiPatch, apiPost, apiPostWithHeaders, apiPut } from "./apiClient";

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
    await expect(request("/logout", {}, "token", { skipGlobalErrorHandling: true })).rejects.toBeInstanceOf(ApiError);
    expect(location.href).toBe("/profile");
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
