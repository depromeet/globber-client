import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isValidYearMonth, YEAR_MONTH_RANGE_MESSAGE, yearMonthSchema } from "./date";

describe("yearMonthSchema 날짜 범위 (GLB-260)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10)); // 2026년 11월
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1900년 1월부터 이번 달까지는 통과한다", () => {
    expect(isValidYearMonth("1900.01")).toBe(true);
    expect(isValidYearMonth("2024.05")).toBe(true);
    expect(isValidYearMonth("2026.11")).toBe(true);
  });

  it("1900년 이전과 아직 오지 않은 달은 막고 범위 안내 문구를 준다", () => {
    for (const value of ["0000.01", "1899.12", "2026.12", "2027.01", "9999.12"]) {
      const result = yearMonthSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map(issue => issue.message)).toContain(YEAR_MONTH_RANGE_MESSAGE);
    }
  });

  it("형식과 월 검사는 그대로 동작한다", () => {
    expect(isValidYearMonth("2024.13")).toBe(false);
    expect(isValidYearMonth("2024.00")).toBe(false);
    expect(isValidYearMonth("202405")).toBe(false);
  });
});
