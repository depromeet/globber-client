import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({ env: { S3_BASE_URL: "https://bucket.test/" } }));

import { resolveImageUrl } from "./imageUrl";

describe("resolveImageUrl", () => {
  it("서버가 준 전체 URL은 그대로 쓴다", () => {
    expect(resolveImageUrl("https://bucket.test/profiles/1/a.jpg")).toBe("https://bucket.test/profiles/1/a.jpg");
    expect(resolveImageUrl("https://cdn.test/a.jpg", "travels/1/a.jpg")).toBe("https://cdn.test/a.jpg");
  });

  it("예전 응답처럼 S3 키만 오면 S3 주소를 붙인다", () => {
    expect(resolveImageUrl("profiles/1/a.jpg")).toBe("https://bucket.test/profiles/1/a.jpg");
    expect(resolveImageUrl(undefined, "travels/1/a.jpg")).toBe("https://bucket.test/travels/1/a.jpg");
    expect(resolveImageUrl(null, "travels/1/a.jpg")).toBe("https://bucket.test/travels/1/a.jpg");
  });

  it("주소와 키가 모두 없으면 null", () => {
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl("", "")).toBeNull();
    expect(resolveImageUrl("  ", null)).toBeNull();
  });
});
