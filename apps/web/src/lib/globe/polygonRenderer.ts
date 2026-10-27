import type { GeoJSONFeature } from "@globber/shared/types/geography";
import type { CountryData } from "@globber/shared/types/travelPatterns";

import { COLORS, ISO_CODE_MAP } from "@/constants/globeConfig";

// ISO 코드 변환 유틸리티
export const getISOCode = (countryId: string): string => {
  return ISO_CODE_MAP[countryId] || countryId;
};

// 폴리곤 색상 계산
export const getPolygonColor = (
  feature: GeoJSONFeature,
  countries: CountryData[],
  getISOCode: (id: string) => string
) => {
  const isoCode = feature.id;
  const countryData = countries.find(c => getISOCode(c.id) === String(isoCode));

  // 여행 데이터가 없는 국가는 비활성 색상
  if (!countryData) return COLORS.INACTIVE_POLYGON;

  // 여행 데이터가 있는 국가는 globe 레벨 색상 적용
  // 해당 국가의 도시 수 계산
  const countryCode = getISOCode(countryData.id);
  const cityCount = countries.filter(c => getISOCode(c.id) === countryCode).length;

  // Globe Leveling Color 기준
  if (cityCount >= 8) return COLORS.GLOBE_LV3; // 8개 이상 도시: Blue 0 (#67E8FF)
  if (cityCount >= 5) return COLORS.GLOBE_LV2; // 5개 이상 도시: Blue 100 (#00CAED)
  return COLORS.GLOBE_LV1; // 1개 이상 도시: Blue 200 (#0084B0)
};

/**
 * 브라우저 줌 방지 이벤트 리스너를 생성합니다.
 * @returns 이벤트 핸들러 객체
 * @note preventTouchZoom은 반드시 { passive: false } 옵션과 함께 등록해야 합니다.
 */
export const createZoomPreventListeners = () => {
  const preventZoom = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };

  const preventKeyboardZoom = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
      e.preventDefault();
    }
  };

  const preventTouchZoom = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };

  return { preventZoom, preventKeyboardZoom, preventTouchZoom };
};
