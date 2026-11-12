import type { KoreanContinent } from "../types/geography";
import type { Continent } from "../types/record";

/**
 * 대륙 목록(국가 데이터 기준 이름). 국가 → 대륙 매핑과 리스트 보기 탭 순서에 쓴다.
 * 대륙 이름과 표시명은 이 파일에서만 정의한다 (GLB-287)
 */
export const KOREAN_CONTINENTS = [
  "아시아",
  "유럽",
  "북아메리카",
  "남아메리카",
  "오세아니아",
  "아프리카",
] as const satisfies readonly KoreanContinent[];

/** 화면에 보이는 대륙 이름(북아메리카 → 북미 등) */
export const CONTINENT_DISPLAY_NAME = {
  아시아: "아시아",
  유럽: "유럽",
  북아메리카: "북미",
  남아메리카: "남미",
  오세아니아: "오세아니아",
  아프리카: "아프리카",
} as const satisfies Record<KoreanContinent, Exclude<Continent, "전체">>;

/** /record 대륙 필터의 기본 순서. 국가 수가 같을 때 이 순서를 유지한다 */
export const RECORD_CONTINENT_ORDER = [
  "전체",
  "아시아",
  "유럽",
  "북미",
  "남미",
  "아프리카",
  "오세아니아",
] as const satisfies readonly Continent[];

export const isKoreanContinent = (value: string): value is KoreanContinent =>
  (KOREAN_CONTINENTS as readonly string[]).includes(value);

/** 주어진 키마다 0으로 채운 집계 객체를 만든다 */
export const createZeroCounts = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map(key => [key, 0])) as Record<K, number>;
