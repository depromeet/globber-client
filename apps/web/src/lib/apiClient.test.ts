import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiGet, apiPost, INVALID_RESPONSE_STATUS } from "./apiClient";

const mockFetchResponse = (body: string | null, init: ResponseInit) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, init))
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient 응답 본문 파싱", () => {
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
