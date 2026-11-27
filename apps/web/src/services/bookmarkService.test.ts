import { afterEach, expect, it, vi } from "vitest";

import { ApiError, LoginRequiredError } from "@/lib/apiClient";
import { reportError } from "@/utils/sentry";

import { addBookmark, getBookmarks, removeBookmark } from "./bookmarkService";

vi.mock("@/config/env", () => ({ env: { API_BASE_URL: "https://api.example.test", IS_LOCAL_DEV: false } }));
vi.mock("@/utils/cookies", () => ({ getAuthInfo: () => ({ token: "token" }), clearAuthCookies: vi.fn() }));
vi.mock("@/utils/sentry", () => ({ reportError: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(reportError).mockClear();
});

const toggles = [
  ["저장", () => addBookmark(1, undefined, { skipServerErrorRedirect: true })],
  ["저장 취소", () => removeBookmark(1, { skipServerErrorRedirect: true })],
] as const;

it.each(toggles)(
  "%s 요청이 5xx로 실패해도 skipServerErrorRedirect면 오류 화면으로 이동하지 않는다 (GLB-158)",
  async (_, run) => {
    const location = { href: "/saved-globe", pathname: "/saved-globe", search: "" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));

    await expect(run()).rejects.toBeInstanceOf(Error);
    expect(location.href).toBe("/saved-globe");
  }
);

it("옵션 없이 호출하면 기존처럼 5xx에서 오류 화면으로 이동한다", async () => {
  const location = { href: "/globe/abc", pathname: "/globe/abc", search: "" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));

  await expect(removeBookmark(1)).rejects.toBeInstanceOf(Error);
  expect(location.href).toContain("type=500");
});

it.each(toggles)(
  "%s 요청이 실패하면 status·endpoint가 남은 원본 ApiError를 그대로 던진다 (GLB-240)",
  async (_, run) => {
    vi.stubGlobal("window", { location: { href: "/saved-globe", pathname: "/saved-globe", search: "" } });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));

    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, endpoint: expect.stringContaining("/api/v1/bookmarks") });
  }
);

it("저장 취소가 401이면 일반 오류로 바꾸지 않고 401 ApiError를 던진다 (GLB-240)", async () => {
  vi.stubGlobal("window", { location: { href: "/saved-globe", pathname: "/saved-globe", search: "" } });
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

  await expect(removeBookmark(1, { skipServerErrorRedirect: true })).rejects.toMatchObject({ status: 401 });
});

it("저장이 401이면 기존처럼 LoginRequiredError를 던진다", async () => {
  const location = { href: "/globe/abc", pathname: "/globe/abc", search: "" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

  await expect(addBookmark(1)).rejects.toBeInstanceOf(LoginRequiredError);
  expect(location.href).toBe("/login");
});

it("목록 조회가 5xx로 실패하면 원본 ApiError를 보고하고 화면에는 고정 문구를 던진다 (GLB-240)", async () => {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));

  await expect(getBookmarks("token")).rejects.toThrow(
    "저장된 지구본 목록을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요."
  );
  expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }), expect.anything());
});

it("목록 조회가 401이면 보고하지 않고 401 ApiError를 그대로 던진다", async () => {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

  await expect(getBookmarks("token")).rejects.toMatchObject({ status: 401 });
  expect(reportError).not.toHaveBeenCalled();
});
