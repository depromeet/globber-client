import { describe, expect, it } from "vitest";

import { toErrorTypeFromStatus } from "./errorType";

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
