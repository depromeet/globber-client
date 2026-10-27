/**
 * @file calculations.ts
 * @description Globe 및 클러스터링 관련 모든 계산 로직 통합
 * @responsibility 거리 계산, 텍스트/버블 너비 계산, 회전 감지 등 순수 계산 함수 제공
 */

import {
  BUBBLE_FLAG_WIDTH,
  BUBBLE_GAP,
  CITY_CLUSTER_PADDING,
  CONTINENT_CLUSTER_FONT_SIZE,
  CONTINENT_CLUSTER_PADDING,
  COUNT_BADGE_WIDTH,
  COUNTRY_CLUSTER_FONT_SIZE,
  COUNTRY_CLUSTER_PADDING,
  EARTH_RADIUS_KM,
  ROTATION_THRESHOLD,
} from "@/constants/clusteringConstants";
import type { ClusterData } from "@/types/clustering";

// ============================================
// 텍스트 너비 계산
// ============================================

/**
 * 동적 텍스트 너비 계산 (한글/영문 구분)
 * @param text - 계산할 텍스트
 * @param fontSize - 폰트 크기 (기본값: 14px)
 * @returns 계산된 텍스트 너비 (px)
 * @responsibility 한글과 영문의 너비 차이를 고려한 정확한 텍스트 너비 계산
 *
 * @description
 * - 한글: fontSize * 0.8
 * - 영문/숫자: fontSize * 0.55
 * - 문자별 너비를 개별 계산하여 정확한 총 너비 반환
 */
export const calculateTextWidth = (text: string, fontSize: number = 14) => {
  let totalWidth = 0;
  const koreanCharRegex = /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/;
  // 한글과 영문/숫자의 너비 비율
  const koreanWidth = fontSize * 0.8;
  const asciiWidth = fontSize * 0.55;

  for (const char of text) {
    if (koreanCharRegex.test(char)) totalWidth += koreanWidth;
    else totalWidth += asciiWidth;
  }

  return totalWidth;
};

// ============================================
// 버블 너비 계산
// ============================================

/**
 * 버블 전체 너비 추정 (클러스터 타입별)
 * @param cluster - 클러스터 데이터
 * @returns 계산된 버블 너비 (px)
 * @responsibility 클러스터 타입에 따라 적절한 버블 너비 계산
 *
 * @description
 * - continent_cluster: 텍스트 + 국기 + 패딩
 * - country_cluster: 텍스트 + 국기 + 패딩 + 도시 개수 배지
 * - individual_city: 텍스트 + 국기 + 패딩
 */
export const estimateBubbleWidth = (cluster: ClusterData) => {
  if (cluster.clusterType === "continent_cluster") {
    const textWidth = calculateTextWidth(cluster.name, CONTINENT_CLUSTER_FONT_SIZE);
    return textWidth + BUBBLE_FLAG_WIDTH + CONTINENT_CLUSTER_PADDING * 2 + BUBBLE_GAP;
  }

  if (cluster.clusterType === "country_cluster") {
    const textWidth = calculateTextWidth(cluster.name, COUNTRY_CLUSTER_FONT_SIZE);
    const countBadgeWidth = cluster.count > 1 ? COUNT_BADGE_WIDTH : 0;
    const badgeGap = cluster.count > 1 ? BUBBLE_GAP : 0;

    return textWidth + BUBBLE_FLAG_WIDTH + COUNTRY_CLUSTER_PADDING * 2 + countBadgeWidth + badgeGap;
  }

  // individual_city
  const textWidth = calculateTextWidth(cluster.name, COUNTRY_CLUSTER_FONT_SIZE);
  return textWidth + BUBBLE_FLAG_WIDTH + CITY_CLUSTER_PADDING * 2 + BUBBLE_GAP;
};

/**
 * 라벨 전체 너비 계산 (국가 클러스터용)
 * @param countryName - 국가명
 * @param cityCount - 도시 개수
 * @returns 계산된 라벨 너비 (px)
 * @responsibility HTML 렌더링 시 필요한 국가 라벨 너비 계산
 */
export const calculateCountryLabelWidth = (countryName: string, cityCount: number) => {
  const flagWidth = 14; // 국기 이모지 너비
  const textWidth = calculateTextWidth(countryName, 14);
  const badgeWidth = cityCount >= 1 ? 22 : 0; // 배지 최소 너비
  const gaps = 5 * 2; // gap 5px * 2
  const padding = 12; // 좌측 패딩만 (우측 패딩 제외)

  return flagWidth + textWidth + badgeWidth + gaps + padding;
};

/**
 * 도시 라벨 너비 계산
 * @param cityName - 도시명
 * @returns 계산된 라벨 너비 (px)
 * @responsibility HTML 렌더링 시 필요한 도시 라벨 너비 계산
 */
export const calculateCityLabelWidth = (cityName: string) => {
  const flagWidth = 14; // 국기 이모지 너비
  const textWidth = calculateTextWidth(cityName, 14);
  const gaps = 5; // gap 5px
  const padding = 12;

  return flagWidth + textWidth + gaps + padding;
};

// ============================================
// 라벨 위치 계산
// ============================================

/**
 * 라벨 오프셋 좌표 계산
 * - 45도 대각선 방향으로 라벨을 배치하기 위한 x, y 좌표 계산
 */
export const calculateLabelOffset = (angleOffset: number, distance: number) => {
  const lineLength = distance * 0.7;
  const diagonalEnd = lineLength * Math.cos(Math.PI / 4); // cos(45°) = sin(45°) = √2/2

  const offsetX = angleOffset === 0 ? diagonalEnd : -diagonalEnd;
  const offsetY = -diagonalEnd; // 항상 위쪽 방향

  return { lineLength, offsetX, offsetY };
};

// ============================================
// 거리 계산
// ============================================

/**
 * 하버신 공식으로 실제 거리 계산 (km 단위)
 * @param lat1 - 첫 번째 지점의 위도
 * @param lng1 - 첫 번째 지점의 경도
 * @param lat2 - 두 번째 지점의 위도
 * @param lng2 - 두 번째 지점의 경도
 * @returns 두 지점 사이의 거리 (km)
 * @responsibility 지구 표면 상의 두 지점 사이 실제 거리 계산
 *
 * @description
 * 하버신 공식을 사용하여 지구 표면에서의 최단 거리 계산
 * 서브클러스터링 시 지리적으로 가까운 국가들을 그룹핑하는데 사용
 */
export const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

/**
 * 회전 감지를 위한 거리 계산
 * @param lat1 - 이전 위도
 * @param lng1 - 이전 경도
 * @param lat2 - 현재 위도
 * @param lng2 - 현재 경도
 * @returns 회전 거리 (도 단위)
 * @responsibility 지구본 회전 정도를 측정하여 모드 전환 판단에 사용
 *
 * @description
 * 간단한 유클리드 거리 계산으로 회전량 측정
 * 하버신 공식보다 계산이 빠르며 회전 감지 목적에 충분히 정확함
 */
export const calculateRotationDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);

  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
};

/**
 * 의미 있는 회전인지 판단
 * @param currentLat - 현재 위도
 * @param currentLng - 현재 경도
 * @param lastLat - 이전 위도
 * @param lastLng - 이전 경도
 * @returns 의미있는 회전 여부
 * @responsibility 회전이 임계값을 초과했는지 판단하여 모드 전환 트리거
 *
 * @description
 * ROTATION_THRESHOLD보다 큰 회전이 발생하면 true 반환
 * 도시 모드에서 국가 모드로 자동 복귀하는 트리거로 사용됨
 */
export const isSignificantRotation = (currentLat: number, currentLng: number, lastLat: number, lastLng: number) => {
  const rotationDistance = calculateRotationDistance(currentLat, currentLng, lastLat, lastLng);
  return rotationDistance > ROTATION_THRESHOLD;
};
