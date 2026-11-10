import { describe, expect, it } from "vitest";

import type { RecordCity } from "../types/record";
import { calculateContinentStats } from "./recordUtils";

describe("기록 대륙별 국가 수", () => {
  const city = (cityId: number, countryCode: string): RecordCity => ({
    cityId,
    countryCode,
    name: "도시",
    lat: 0,
    lng: 0,
  });

  it("같은 국가의 두 도시는 한 국가로 계산한다", () => {
    const result = calculateContinentStats([
      { regionName: "일본", cityCount: 2, cities: [city(1, "JPN"), city(2, "JPN")] },
    ]);
    expect(result.전체).toBe(1);
    expect(result.아시아).toBe(1);
  });

  it("여러 지역에 중복된 국가도 한 번만 세고 전체와 대륙별 합이 일치한다", () => {
    const result = calculateContinentStats([
      { regionName: "첫 지역", cityCount: 2, cities: [city(1, "JPN"), city(2, "FRA")] },
      { regionName: "둘째 지역", cityCount: 2, cities: [city(3, "JPN"), city(4, "KOR")] },
    ]);
    expect(result).toEqual({ 전체: 3, 아시아: 2, 유럽: 1, 북미: 0, 남미: 0, 아프리카: 0, 오세아니아: 0 });
  });

  it("빈 기록은 모든 국가 수가 0이다", () => {
    expect(calculateContinentStats([]).전체).toBe(0);
  });
});
