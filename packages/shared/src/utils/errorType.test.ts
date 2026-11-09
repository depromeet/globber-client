import { describe, expect, it } from "vitest";

import { buildErrorPagePath, toSafeReturnPath } from "./errorType";

describe("toSafeReturnPath", () => {
  it("같은 사이트 경로는 그대로 돌려준다", () => {
    expect(toSafeReturnPath("/record")).toBe("/record");
    expect(toSafeReturnPath("/record/edit?added=%5B1%5D")).toBe("/record/edit?added=%5B1%5D");
    expect(toSafeReturnPath("/globe/abc#top")).toBe("/globe/abc#top");
  });

  it("다른 사이트로 가는 주소는 거른다", () => {
    expect(toSafeReturnPath("//evil.com")).toBeNull();
    expect(toSafeReturnPath("/\\evil.com")).toBeNull();
    expect(toSafeReturnPath("/\t/evil.com")).toBeNull();
    expect(toSafeReturnPath("https://evil.com/record")).toBeNull();
    expect(toSafeReturnPath("javascript:alert(1)")).toBeNull();
  });

  it("오류 화면 자신과 빈 값은 거른다", () => {
    expect(toSafeReturnPath("/error")).toBeNull();
    expect(toSafeReturnPath("/error?type=500")).toBeNull();
    expect(toSafeReturnPath("")).toBeNull();
    expect(toSafeReturnPath(null)).toBeNull();
    expect(toSafeReturnPath(`/${"a".repeat(2001)}`)).toBeNull();
  });
});

describe("buildErrorPagePath", () => {
  it("from이 없으면 오류 종류만 붙인다", () => {
    expect(buildErrorPagePath("500")).toBe("/error?type=500");
  });

  it("안전한 from은 인코딩해서 붙이고, 위험한 from은 버린다", () => {
    expect(buildErrorPagePath("500", "/record/edit?added=1")).toBe("/error?type=500&from=%2Frecord%2Fedit%3Fadded%3D1");
    expect(buildErrorPagePath("500", "//evil.com")).toBe("/error?type=500");
  });
});
