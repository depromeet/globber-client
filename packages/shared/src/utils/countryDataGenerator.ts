import worldCountries from "world-countries";

import type { KoreanContinent, WorldCountry } from "../types/geography";

const englishRegionToKorean = (region?: string, subregion?: string): KoreanContinent | "기타" => {
  if (region === "Asia") return "아시아";
  if (region === "Europe") return "유럽";
  if (region === "Africa") return "아프리카";
  if (region === "Oceania") return "오세아니아";
  if (region === "Americas") {
    // 세부 분류를 이용해 북/남아메리카로 분리
    if (subregion === "South America") return "남아메리카";
    return "북아메리카"; // Northern/Central/Caribbean 포함
  }
  return "기타";
};

const getKoreanName = (country: WorldCountry): string => {
  const kor = country?.translations?.kor?.common;
  const zho = country?.translations?.zho?.common; // 한국어가 없을 때 가끔 한자 이름이 더 나을 수 있음
  return kor || country?.name?.common || zho || country?.cca3;
};

// 보기 좋게 한글명 기준으로 정렬된 오브젝트로 변환
const sortByValue = (obj: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => a[1].localeCompare(b[1], "ko")));
};

// 전 세계 ISO 3166-1 alpha-3 기준으로 대륙별 매핑 생성
export const generateCountriesByContinent = (): Record<KoreanContinent, Record<string, string>> => {
  const generatedByContinent = (worldCountries as WorldCountry[]).reduce<
    Record<KoreanContinent, Record<string, string>>
  >(
    (acc, c) => {
      const continent = englishRegionToKorean(c.region, c.subregion);
      if (continent === "기타") return acc;
      const code: string = c.cca3;
      const name: string = getKoreanName(c);
      if (!acc[continent]) acc[continent] = {} as Record<string, string>;
      acc[continent][code] = name;
      return acc;
    },
    {
      아시아: {},
      유럽: {},
      북아메리카: {},
      남아메리카: {},
      오세아니아: {},
      아프리카: {},
    }
  );

  return {
    아시아: sortByValue(generatedByContinent.아시아),
    유럽: sortByValue(generatedByContinent.유럽),
    북아메리카: sortByValue(generatedByContinent.북아메리카),
    남아메리카: sortByValue(generatedByContinent.남아메리카),
    오세아니아: sortByValue(generatedByContinent.오세아니아),
    아프리카: sortByValue(generatedByContinent.아프리카),
  };
};
