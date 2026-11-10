import { describe, expect, it } from "vitest";

import { buildErrorPagePath, toErrorTypeFromStatus, toSafeReturnPath } from "./errorType";

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
    expect(toSafeReturnPath("/x/..//evil.com")).toBeNull();
    expect(toSafeReturnPath("/x/../\\evil.com")).toBeNull();
    expect(toSafeReturnPath("/%2e%2e//evil.com")).toBeNull();
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

describe("toErrorTypeFromStatus", () => {
  it("403은 404 화면 유형으로 바꾼다", () => {
    expect(toErrorTypeFromStatus(403)).toBe("404");
  });

  it("401·404·408·5xx는 각 화면 유형으로 바꾼다", () => {
    expect(toErrorTypeFromStatus(401)).toBe("401");
    expect(toErrorTypeFromStatus(404)).toBe("404");
    expect(toErrorTypeFromStatus(408)).toBe("500");
    expect(toErrorTypeFromStatus(503)).toBe("500");
  });

  it("그 밖의 상태는 null을 돌려준다", () => {
    expect(toErrorTypeFromStatus(400)).toBeNull();
    expect(toErrorTypeFromStatus(undefined)).toBeNull();
  });
});
