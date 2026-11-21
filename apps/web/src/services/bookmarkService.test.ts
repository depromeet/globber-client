import { afterEach, expect, it, vi } from "vitest";

import { addBookmark, removeBookmark } from "./bookmarkService";

vi.mock("@/config/env", () => ({ env: { API_BASE_URL: "https://api.example.test", IS_LOCAL_DEV: false } }));
vi.mock("@/utils/cookies", () => ({ getAuthInfo: () => ({ token: "token" }), clearAuthCookies: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

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
