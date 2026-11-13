import { expect, it } from "vitest";

import { GET } from "./route";

it("OAuth 실패로 돌아오면 실패 안내와 함께 로그인으로 보낸다 (GLB-387)", async () => {
  const response = await GET();
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("/login?error=oauth_failed");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
