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

  // Globe 레벨 색상 기준
  if (cityCount >= 8) return COLORS.GLOBE_LV3; // 8개 이상 도시: Blue 0 (#67E8FF)
  if (cityCount >= 5) return COLORS.GLOBE_LV2; // 5개 이상 도시: Blue 100 (#00CAED)
  return COLORS.GLOBE_LV1; // 1개 이상 도시: Blue 200 (#0084B0)
};

/**
 * 지구본 위 휠·핀치 조작이 브라우저 페이지 확대로 새지 않게 막는 이벤트 리스너를 생성합니다.
 * 지구본 컨테이너에만 등록합니다. 페이지 전체(document)에 걸면 접근성 확대까지 막히므로 피합니다.
 * @returns 이벤트 핸들러 객체
 * @note 두 핸들러 모두 반드시 { passive: false } 옵션과 함께 등록해야 합니다.
 */
export const createZoomPreventListeners = () => {
  // 트랙패드 핀치·Ctrl+휠은 ctrlKey가 켜진 wheel 이벤트로 들어온다
  const preventZoom = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };

  const preventTouchZoom = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };

  return { preventZoom, preventTouchZoom };
};
