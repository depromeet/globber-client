import { expect, it } from "vitest";

import { getContinentFromCountryCode, sortContinentsByCount } from "../utils/recordUtils";
import {
  CONTINENT_DISPLAY_NAME,
  createZeroCounts,
  isKoreanContinent,
  KOREAN_CONTINENTS,
  RECORD_CONTINENT_ORDER,
} from "./continent";
import { COUNTRIES_BY_CONTINENT, getContinent } from "./countryMapping";

it("국가 매핑은 대륙 목록 순서대로 모든 대륙을 갖는다", () => {
  expect(Object.keys(COUNTRIES_BY_CONTINENT)).toEqual([...KOREAN_CONTINENTS]);
  for (const continent of KOREAN_CONTINENTS) {
    expect(Object.keys(COUNTRIES_BY_CONTINENT[continent]).length).toBeGreaterThan(0);
  }
});

it("국가 코드를 데이터 기준 대륙과 화면 표시 대륙으로 바꾼다", () => {
  expect(getContinent("USA")).toBe("북아메리카");
  expect(getContinentFromCountryCode("USA")).toBe("북미");
  expect(getContinentFromCountryCode("BRA")).toBe("남미");
  expect(getContinentFromCountryCode("FRA")).toBe("유럽");
  expect(getContinentFromCountryCode("AUS")).toBe("오세아니아");
  // 매핑에 없는 코드는 기존 동작대로 아시아
  expect(getContinent("ZZZ")).toBe("기타");
  expect(getContinentFromCountryCode("ZZZ")).toBe("아시아");
});

it("모든 대륙에 표시명이 있고, 대륙 판별은 목록에 있는 이름만 통과시킨다", () => {
  expect(Object.keys(CONTINENT_DISPLAY_NAME)).toEqual([...KOREAN_CONTINENTS]);
  expect(isKoreanContinent("북아메리카")).toBe(true);
  expect(isKoreanContinent("북미")).toBe(false);
  expect(isKoreanContinent("기타")).toBe(false);
});

it("/record 대륙 필터는 국가 수가 같으면 기존 순서를 유지한다", () => {
  const stats = { ...createZeroCounts(["전체", "아시아", "유럽", "북미", "남미", "아프리카", "오세아니아"] as const) };
  expect(sortContinentsByCount(stats)).toEqual(["전체", "아시아", "유럽", "북미", "남미", "아프리카", "오세아니아"]);
  stats.전체 = 2;
  stats.오세아니아 = 1;
  stats.유럽 = 1;
  expect(sortContinentsByCount(stats)).toEqual(["전체", "유럽", "오세아니아", "아시아", "북미", "남미", "아프리카"]);
  // 정렬이 기본 순서 상수를 바꾸지 않는다
  expect(RECORD_CONTINENT_ORDER).toEqual(["전체", "아시아", "유럽", "북미", "남미", "아프리카", "오세아니아"]);
});
