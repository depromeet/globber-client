import type { KoreanContinent } from "../types/geography";
import { generateCountriesByContinent } from "../utils/countryDataGenerator";
import { buildAlpha3ToFlagMap } from "../utils/flagEmoji";

// 전 세계 ISO 3166-1 alpha-3 기준으로 대륙별 매핑 데이터
export const COUNTRIES_BY_CONTINENT: Record<KoreanContinent, Record<string, string>> = generateCountriesByContinent();

// 기존 호환성을 위한 플랫 맵
export const COUNTRY_CODE_TO_NAME: { [key: string]: string } = (() => {
  const flat: { [key: string]: string } = {};
  for (const countries of Object.values(COUNTRIES_BY_CONTINENT)) {
    Object.assign(flat, countries);
  }
  return flat;
})();

// ISO-3 코드(cca3) → 국기 이모지
export const COUNTRY_CODE_TO_FLAG: { [key: string]: string } = buildAlpha3ToFlagMap();

// 국가 코드에서 나라명을 가져오는 함수
export const getCountryName = (countryCode: string) => COUNTRY_CODE_TO_NAME[countryCode] || countryCode;

// 국가 코드에서 대륙명을 가져오는 함수
export const getContinent = (countryCode: string) => {
  for (const [continent, countries] of Object.entries(COUNTRIES_BY_CONTINENT)) {
    if (countryCode in countries) return continent;
  }

  return "기타";
};

// 여러 국가 코드를 받아서 고유한 나라명들을 반환
export const getUniqueCountryNames = (countryCodes: string[]): string[] => {
  const uniqueNames = new Set(countryCodes.map(code => getCountryName(code)));

  return Array.from(uniqueNames);
};

// 여러 국가가 같은 대륙인지 확인
export const areSameContinent = (countryCodes: string[]): boolean => {
  const continents = new Set(countryCodes.map(code => getContinent(code)));

  return continents.size === 1;
};

// 대륙별 클러스터 이름 생성
export const getContinentClusterName = (countryCodes: string[]): string => {
  const uniqueContinents = new Set(countryCodes.map(code => getContinent(code)));

  if (uniqueContinents.size === 1) {
    const continent = Array.from(uniqueContinents)[0];
    const uniqueCountries = new Set(countryCodes);

    return `${continent} +${uniqueCountries.size}`;
  }

  const uniqueCountries = new Set(countryCodes);

  return `${uniqueCountries.size}개국`;
};
