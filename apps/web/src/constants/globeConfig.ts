/**
 * @file globeConfig.ts
 * @description Globe 컴포넌트 렌더러 설정 상수 모음
 * @responsibility Globe 시각화에 필요한 정적 설정값 제공
 *                 (줌 레벨 임계값은 clusteringConstants.ts 참조)
 */

import worldCountries from "world-countries";

// Globe 렌더러 설정 상수
// 줌 레벨 관련 값(INITIAL_ALTITUDE, MAX_ZOOM 등)은 clusteringConstants.ts의 ZOOM_LEVELS.DEFAULT 참조
export const GLOBE_CONFIG = {
  WIDTH: 600, // 지구본 컴포넌트 너비 (px)
  HEIGHT: 800, // 지구본 컴포넌트 높이 (px)
  MIN_ZOOM: 0.01, // 최소 줌 레벨
  CLUSTER_ZOOM: 0.17, // 2단계 줌 (나라 단위가 보이는 수준)
  MIN_DISTANCE: 110, // 최소 카메라 거리 (Globe.gl 단위 기준)
  MAX_DISTANCE: 500, // 최대 카메라 거리 (Globe.gl 단위 기준, 100*(1+4)=500 → altitude 4 = 기본 뷰)
  ATMOSPHERE_ALTITUDE: 0, // 대기권 두께 (지구 반지름 배수)
  POLYGON_ALTITUDE: 0.01, // 국경선/폴리곤 높이 (지구 표면 기준)
  HTML_ALTITUDE: 0.01, // HTML 라벨 높이 (지구 표면 기준)
} as const;

// 라벨 오프셋 설정
export const LABEL_OFFSET = {
  X: 50, // 라벨 수평 오프셋 (px)
  Y: -30, // 라벨 수직 오프셋 (px)
} as const;

// 애니메이션 시간 (ms)
export const ANIMATION_DURATION = {
  CAMERA_MOVE: 1500, // 카메라 이동 애니메이션 시간 (더 빠르게)
  INITIAL_SETUP: 1000, // 초기 설정 완료 대기 시간
  ZOOM_UPDATE_DELAY: 50, // 줌 업데이트 디바운스 시간 (더 빠르게)
  SETUP_DELAY: 100, // 설정 지연 시간 (더 빠르게)
} as const;

// 색상 설정
export const COLORS = {
  ATMOSPHERE: "#4a90e2", // 대기권 색상 (파란색)
  CLUSTER: "#4a90e2", // 클러스터 마커 색상
  CLUSTER_BG: "#2c3e50", // 클러스터 배경 색상 (어두운 회색)
  POLYGON_SIDE: "rgba(105,105,105, 0.1)", // 폴리곤 측면 색상 (dimgray와 동일한 색상)
  POLYGON_STROKE: "dimgray", // 국경선 색상
  INACTIVE_POLYGON: "#94cbff33", // 비활성 폴리곤 색상 (매우 연한 회색)
  // Globe Leveling Color (디자인 시스템 기준)
  GLOBE_LV1: "#0084B0", // Blue 200 - 1개 이상 도시
  GLOBE_LV2: "#00CAED", // Blue 100 - 5개 이상 도시
  GLOBE_LV3: "#67E8FF", // Blue 0 - 8개 이상 도시
  WHITE_LABEL: "rgba(255,255,255,0.8)", // 흰색 라벨 텍스트 색상
  WHITE_BORDER: "rgba(255,255,255,0.6)", // 흰색 테두리 색상
} as const;

// ISO 3166-1 국가코드 매핑 (world-countries 기반)
export const ISO_CODE_MAP: { [key: string]: string } = worldCountries.reduce<{ [key: string]: string }>(
  (acc, country) => {
    const code = country.cca3;
    acc[code] = code; // ISO 코드를 그대로 매핑
    return acc;
  },
  {}
);

// 외부 리소스 URL
export const EXTERNAL_URLS = {
  // 세계 지도 GeoJSON 데이터 URL (로컬 번들, public/data/world.geojson)
  WORLD_GEOJSON: "/data/world.geojson",
  NIGHT_SKY_IMAGE: "//unpkg.com/three-globe/example/img/night-sky.png", // 배경 별하늘 이미지 URL
} as const;

// 브라우저 뷰포트 기본값 (SSR 폴백용) — Globe.tsx에서 window 접근 불가 시 사용
export const VIEWPORT_DEFAULTS = {
  WIDTH: 600, // SSR 시 기본 너비
  HEIGHT: 800, // SSR 시 기본 높이
} as const;
