import worldCountries from "world-countries";

import type { WorldCountry } from "../types/geography";

// A-Z를 지역 표시 문자로 변환하여 국기 이모지 생성
export const alpha2ToFlagEmoji = (alpha2: string): string => {
  if (!alpha2 || alpha2.length !== 2) return "";
  const codePoints = [...alpha2.toUpperCase()].map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
};

// 데이터셋 기준 ISO3 → 국기 이모지 매핑 구축
export const buildAlpha3ToFlagMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const c of worldCountries as WorldCountry[]) {
    const alpha2 = c.cca2 || "";
    const emoji = alpha2ToFlagEmoji(alpha2);
    if (emoji) map[c.cca3] = emoji;
  }
  return map;
};
