import { afterEach, expect, it, vi } from "vitest";

import { logout } from "./authService";

vi.mock("@/config/env", () => ({ env: { API_BASE_URL: "https://api.example.test", IS_LOCAL_DEV: false } }));
afterEach(() => vi.unstubAllGlobals());

it.each([401, 500])("로그아웃 API %i 오류에도 쿠키를 지우고 전역 오류 이동을 생략한다", async status => {
  const location = { href: "/profile", hostname: "globber.world" };
  const deleted: string[] = [];
  vi.stubGlobal("window", { location });
  vi.stubGlobal("document", {
    set cookie(value: string) {
      deleted.push(value);
    },
  });
  vi.stubGlobal("fetch", async () => new Response(null, { status }));
  await expect(logout("token")).rejects.toMatchObject({ status });
  expect(location.href).toBe("/profile");
  for (const name of ["kakao_access_token", "member_id", "uuid"]) {
    expect(deleted).toContain(`${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`);
  }
});
