import { getContinent as getKoreanContinent } from "../constants/countryMapping";
import type { Continent, RecordRegion } from "../types/record";

export const getContinentFromCountryCode = (countryCode: string): Continent => {
  const korean = getKoreanContinent(countryCode);
  if (korean === "북아메리카") return "북미";
  if (korean === "남아메리카") return "남미";
  if (korean === "아시아" || korean === "유럽" || korean === "아프리카" || korean === "오세아니아") {
    return korean as Continent;
  }
  return "아시아";
};

export const calculateContinentStats = (regions: RecordRegion[]): Record<Continent, number> => {
  const stats: Record<Continent, number> = {
    전체: 0,
    아시아: 0,
    유럽: 0,
    북미: 0,
    남미: 0,
    아프리카: 0,
    오세아니아: 0,
  };

  // 전체 도시 수 계산
  stats.전체 = regions.reduce((total, region) => total + region.cities.length, 0);

  // 대륙별 도시 수 계산
  regions.forEach(region => {
    region.cities.forEach(city => {
      const continent = getContinentFromCountryCode(city.countryCode);
      if (continent in stats) {
        stats[continent] = (stats[continent] || 0) + 1;
      }
    });
  });

  return stats;
};

export const filterRegionsByContinent = (regions: RecordRegion[], selectedContinent: Continent): RecordRegion[] => {
  if (selectedContinent === "전체") {
    return regions;
  }

  return regions
    .map(region => ({
      ...region,
      cities: region.cities.filter(city => getContinentFromCountryCode(city.countryCode) === selectedContinent),
      cityCount: 0, // 필터링 후 다시 계산
    }))
    .map(region => ({
      ...region,
      cityCount: region.cities.length,
    }))
    .filter(region => region.cities.length > 0);
};

export const sortContinentsByCount = (continentStats: Record<Continent, number>): Continent[] => {
  const allContinents: Continent[] = ["전체", "아시아", "유럽", "북미", "남미", "아프리카", "오세아니아"];

  return allContinents.sort((a, b) => continentStats[b] - continentStats[a]);
};

/**
 * 다이어리를 국가별로 그룹핑하여 정렬합니다.
 * 선택한 도시의 국가부터 시작하고, 같은 국가 내 도시들이 함께 표시됩니다.
 *
 * @param diaries - 정렬할 다이어리 목록
 * @param selectedCityId - 선택한 도시 ID (이 도시의 국가를 우선으로)
 * @returns 국가별로 그룹핑되어 정렬된 다이어리 목록
 *
 * @example
 * // 입력: [도쿄(일본), 오사카(일본), 파리(프랑스), 교토(일본)]
 * // 선택: 오사카(cityId: 2)
 * // 결과: [오사카(일본), 도쿄(일본), 교토(일본), 파리(프랑스)]
 */
export const sortDiariesByCountryGrouping = <T extends { cityId: number; city: string; country: string }>(
  diaries: T[],
  selectedCityId: number
): T[] => {
  // 1. 선택한 도시 찾기
  const selectedDiary = diaries.find(diary => diary.cityId === selectedCityId);
  if (!selectedDiary) {
    return diaries;
  }

  // 2. 선택한 도시의 국가
  const selectedCountry = selectedDiary.country;

  // 3. 국가별로 그룹핑
  const countryGroups = new Map<string, typeof diaries>();
  const countryOrder: string[] = [];

  for (const diary of diaries) {
    if (!countryGroups.has(diary.country)) {
      countryGroups.set(diary.country, []);
      countryOrder.push(diary.country);
    }
    const countryDiaries = countryGroups.get(diary.country);
    if (countryDiaries) {
      countryDiaries.push(diary);
    }
  }

  // 4. 같은 국가 내 도시 정렬 (cityId 기준 - 추가 순서 유지)
  for (const countryDiaries of countryGroups.values()) {
    countryDiaries.sort((a, b) => a.cityId - b.cityId);
  }

  // 5. 선택한 국가를 맨 앞으로, 나머지는 원래 순서 유지
  const result: typeof diaries = [];
  const addedCountries = new Set<string>();

  // 5-1. 선택한 국가 먼저 추가 (선택한 도시를 첫 번째로)
  const selectedCountryDiaries = countryGroups.get(selectedCountry);
  if (selectedCountryDiaries) {
    // 선택한 도시를 찾아서 맨 앞으로 이동
    const selectedIndex = selectedCountryDiaries.findIndex(d => d.cityId === selectedCityId);
    if (selectedIndex > 0) {
      // 선택한 도시를 맨 앞으로
      const selectedDiaryItem = selectedCountryDiaries.splice(selectedIndex, 1)[0];
      selectedCountryDiaries.unshift(selectedDiaryItem);
    }
    result.push(...selectedCountryDiaries);
    addedCountries.add(selectedCountry);
  }

  // 5-2. 나머지 국가 추가 (원래 순서 유지)
  for (const country of countryOrder) {
    if (!addedCountries.has(country)) {
      const countryDiaries = countryGroups.get(country);
      if (countryDiaries) {
        result.push(...countryDiaries);
        addedCountries.add(country);
      }
    }
  }

  return result;
};
