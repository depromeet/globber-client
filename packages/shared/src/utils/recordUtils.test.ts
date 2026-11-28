import { describe, expect, it } from "vitest";

import type { RecordCity } from "../types/record";
import { calculateContinentStats, sortDiariesByCountryGrouping } from "./recordUtils";

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

describe("기록 상세 편집 후 복귀 위치 (GLB-140)", () => {
  // 서버 응답 순서. 같은 도시에 기록이 둘인 경우도 포함한다
  const serverDiaries = [
    { id: 1, cityId: 10, city: "서울", country: "한국" },
    { id: 2, cityId: 21, city: "오사카", country: "일본" },
    { id: 3, cityId: 20, city: "도쿄", country: "일본" },
    { id: 4, cityId: 30, city: "파리", country: "프랑스" },
    { id: 5, cityId: 21, city: "오사카", country: "일본" },
  ];

  it.each([
    [30, 5],
    [20, 2],
    [10, 4],
  ])(
    "%i 도시로 들어와 다른 도시 기록(id=%i)을 편집하면, 화면이 계산한 위치가 저장 후 그 도시 상세에서도 같은 기록을 가리킨다",
    (enteredCityId, editedDiaryId) => {
      // 기록 상세 화면이 들고 있는 목록 = 처음 들어온 도시 기준으로 정렬된 목록
      const screenRecords = sortDiariesByCountryGrouping(serverDiaries, enteredCityId);
      const edited = screenRecords.find(r => r.id === editedDiaryId)!;

      // RecordDetailClient.handleEdit이 넘기는 scrollIndex
      const returnIndex = sortDiariesByCountryGrouping(screenRecords, edited.cityId).findIndex(
        r => r.id === editedDiaryId
      );
      // 저장 후 /record/{편집한 기록 cityId} 페이지가 서버 응답으로 만드는 목록
      const returnedRecords = sortDiariesByCountryGrouping(serverDiaries, edited.cityId);

      expect(returnedRecords[returnIndex].id).toBe(editedDiaryId);
    }
  );
});
