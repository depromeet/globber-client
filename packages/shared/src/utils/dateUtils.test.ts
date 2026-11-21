import { expect, it } from "vitest";

import { formatYearMonth, fromApiYearMonth, toApiYearMonth } from "./dateUtils";

it("서버의 YYYY-MM 촬영 월을 화면용 YYYYMM으로 바꾸고, 예전 YYYYMM도 받는다", () => {
  expect(fromApiYearMonth("2025-11")).toBe("202511");
  expect(fromApiYearMonth("202511")).toBe("202511");
  expect(fromApiYearMonth(" 2025-01 ")).toBe("202501");
  expect(fromApiYearMonth(null)).toBeNull();
  expect(fromApiYearMonth("")).toBeNull();
  expect(fromApiYearMonth("2025-1")).toBeNull();
  expect(fromApiYearMonth("2025.11")).toBeNull();
});

it("화면용 YYYYMM을 서버 요청 형식 YYYY-MM으로 바꾼다", () => {
  expect(toApiYearMonth("202511")).toBe("2025-11");
  expect(toApiYearMonth("2025-11")).toBe("2025-11");
  expect(toApiYearMonth(null)).toBeNull();
  expect(toApiYearMonth("20251")).toBeNull();
});

it("서버 촬영 월을 상세 화면 표시 형식 YYYY.MM으로 보여 준다", () => {
  expect(formatYearMonth(fromApiYearMonth("2025-11"))).toBe("2025.11");
  expect(formatYearMonth(fromApiYearMonth(null))).toBeNull();
});
