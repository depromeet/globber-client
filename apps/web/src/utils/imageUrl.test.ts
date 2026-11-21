import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({ env: { S3_BASE_URL: "https://bucket.test/" } }));

import { resolveImageUrl } from "./imageUrl";

describe("resolveImageUrl", () => {
  it("서버가 준 전체 URL은 그대로 쓴다", () => {
    expect(resolveImageUrl("https://bucket.test/profiles/1/a.jpg")).toBe("https://bucket.test/profiles/1/a.jpg");
    expect(resolveImageUrl("https://cdn.test/a.jpg", "travels/1/a.jpg")).toBe("https://cdn.test/a.jpg");
    expect(resolveImageUrl("HTTP://cdn.test/a.jpg")).toBe("HTTP://cdn.test/a.jpg");
  });

  it("data·blob 주소는 그대로, //host 형식은 https로 맞춘다", () => {
    expect(resolveImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(resolveImageUrl("blob:https://site.test/id")).toBe("blob:https://site.test/id");
    expect(resolveImageUrl("//cdn.test/a.jpg")).toBe("https://cdn.test/a.jpg");
  });

  it("예전 응답처럼 S3 키만 오면 S3 주소를 붙인다", () => {
    expect(resolveImageUrl("profiles/1/a.jpg")).toBe("https://bucket.test/profiles/1/a.jpg");
    expect(resolveImageUrl(undefined, "travels/1/a.jpg")).toBe("https://bucket.test/travels/1/a.jpg");
    expect(resolveImageUrl("  ", " travels/1/a.jpg ")).toBe("https://bucket.test/travels/1/a.jpg");
  });

  it("주소와 키가 모두 없으면 null", () => {
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl("", "")).toBeNull();
    expect(resolveImageUrl("  ", null)).toBeNull();
  });
});
