/**
 * world-countries 패키지(약 1.4MB JSON)에서 앱이 쓰는 필드만 뽑아 TS 모듈로 저장합니다.
 * 패키지 JSON 전체를 import하면 클라이언트 번들에 통째로 들어가므로, 생성된 파일만 import합니다.
 *
 * 사용: pnpm countries:build (world-countries 버전을 올린 뒤 다시 실행, 생성 후 prettier로 정리)
 */
const fs = require("node:fs");
const path = require("node:path");

const worldCountries = require("world-countries");

const OUTPUT_PATH = path.join(__dirname, "../src/constants/worldCountries.generated.ts");

// world-countries와 백엔드(CountryCodeMapper)의 국가 코드가 다른 경우. 백엔드가 주는 코드로 맞춰야
// 국가 이름·국기·대륙·지구본 색칠을 찾을 수 있다 (GLB-226)
const CCA3_OVERRIDES = {
  UNK: "XKX", // 코소보: world-countries는 UNK, 백엔드는 XKX
};

const pickCommon = value => (value?.common ? { common: value.common } : undefined);

const countries = worldCountries.map(country => {
  const translations = {};
  for (const lang of ["kor", "zho"]) {
    const translation = pickCommon(country.translations?.[lang]);
    if (translation) translations[lang] = translation;
  }

  return {
    cca2: country.cca2,
    cca3: CCA3_OVERRIDES[country.cca3] ?? country.cca3,
    region: country.region,
    subregion: country.subregion,
    name: pickCommon(country.name),
    translations,
  };
});

const source = `// 이 파일은 scripts/build-world-countries.js가 생성합니다. 직접 고치지 마세요.
import type { WorldCountry } from "../types/geography";

export const WORLD_COUNTRIES: WorldCountry[] = ${JSON.stringify(countries, null, 2)};
`;

fs.writeFileSync(OUTPUT_PATH, source);
console.log(`world-countries ${countries.length}개 국가 → ${path.relative(process.cwd(), OUTPUT_PATH)}`);
