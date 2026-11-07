/**
 * 지구본 자동 fit 기능을 위한 유틸리티 함수들
 * 나라 클러스터 클릭 시 해당 국가의 모든 도시들이 화면에 fit되도록 계산
 */

import type { CountryData } from "@globber/shared/types/travelPatterns";

import { haversineDistance } from "./calculations";

// 지점들의 경계 박스를 계산하는 함수
export const calculateBoundingBox = (cities: CountryData[]) => {
  if (cities.length === 0) {
    return {
      minLat: 0,
      maxLat: 0,
      minLng: 0,
      maxLng: 0,
      centerLat: 0,
      centerLng: 0,
      latRange: 0,
      lngRange: 0,
    };
  }

  let minLat = cities[0].lat;
  let maxLat = cities[0].lat;
  let minLng = cities[0].lng;
  let maxLng = cities[0].lng;

  for (const city of cities) {
    minLat = Math.min(minLat, city.lat);
    maxLat = Math.max(maxLat, city.lat);
    minLng = Math.min(minLng, city.lng);
    maxLng = Math.max(maxLng, city.lng);
  }

  // 경도 경계를 넘는 경우 처리 (예: 180도 경계, 태평양 가로지르는 경우)
  const lngRange = maxLng - minLng;
  if (lngRange > 180) {
    // 경도가 180도를 넘어가는 경우 (예: 일본-미국 서부)
    // 더 짧은 경로를 찾기 위해 음수 경도를 양수로 변환
    const adjustedCities = cities.map(city => ({
      ...city,
      adjustedLng: city.lng < 0 ? city.lng + 360 : city.lng,
    }));

    let adjustedMinLng = adjustedCities[0].adjustedLng;
    let adjustedMaxLng = adjustedCities[0].adjustedLng;

    for (const city of adjustedCities) {
      adjustedMinLng = Math.min(adjustedMinLng, city.adjustedLng);
      adjustedMaxLng = Math.max(adjustedMaxLng, city.adjustedLng);
    }

    const adjustedRange = adjustedMaxLng - adjustedMinLng;
    if (adjustedRange < lngRange) {
      // 조정된 범위가 더 짧다면 사용
      minLng = adjustedMinLng > 180 ? adjustedMinLng - 360 : adjustedMinLng;
      maxLng = adjustedMaxLng > 180 ? adjustedMaxLng - 360 : adjustedMaxLng;
    }
  }

  const centerLat = (minLat + maxLat) / 2;
  // 경도 wraparound를 고려한 중심 계산
  let centerLng: number;
  if (minLng > maxLng) {
    // wraparound 케이스: minLng이 maxLng보다 큰 경우
    centerLng = (minLng + maxLng + 360) / 2;
    if (centerLng > 180) centerLng -= 360;
  } else centerLng = (minLng + maxLng) / 2;

  const latRange = maxLat - minLat;
  const finalLngRange = Math.abs(maxLng - minLng);

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centerLat,
    centerLng,
    latRange,
    lngRange: finalLngRange,
  };
};

// 경계 박스에 맞는 최적의 줌 레벨을 계산하는 함수
export const calculateOptimalZoom = (boundingBox: ReturnType<typeof calculateBoundingBox>): number => {
  const { latRange, lngRange } = boundingBox;

  if (latRange === 0 && lngRange === 0) {
    // 단일 지점인 경우 적당한 줌 레벨 반환
    return 0.15;
  }

  // 라벨 돌출 영역을 고려한 마진 계산
  // 라벨이 약 100-150px 돌출되므로, 이를 각도로 환산
  // 화면 512px에서 150px는 약 29% -> 시야각 110도 기준 약 32도
  const labelMargin = 20; // 각도 단위로 여유 공간

  // 기본 패딩: 범위의 50%를 여백으로 추가
  const basePadding = 0.5;
  const effectiveLatRange = latRange * (1 + basePadding) + labelMargin;
  const effectiveLngRange = lngRange * (1 + basePadding) + labelMargin;

  const maxRange = Math.max(effectiveLatRange, effectiveLngRange);
  const minRange = Math.min(effectiveLatRange, effectiveLngRange);
  const rangeRatio = minRange > 0 ? maxRange / minRange : 1;

  // 줌 레벨 계산
  let zoomLevel: number;

  if (maxRange > 100) {
    // 매우 넓은 범위 (여러 대륙)
    zoomLevel = 2.2;
  } else if (maxRange > 80) {
    // 넓은 범위 (대륙 전체)
    zoomLevel = 1.8;
  } else if (maxRange > 60) {
    // 큰 지역
    zoomLevel = 1.3;
  } else if (maxRange > 40) {
    // 큰 국가 (미국, 러시아 등)
    zoomLevel = 1.0;
  } else if (maxRange > 30) {
    // 중간 크기 국가
    zoomLevel = 0.7;
  } else if (maxRange > 20) {
    // 작은 국가
    zoomLevel = 0.5;
  } else if (maxRange > 12) {
    // 매우 작은 지역
    zoomLevel = 0.3;
  } else if (maxRange > 6) {
    // 도시 내 여러 지점
    zoomLevel = 0.2;
  } else {
    // 매우 가까운 지점들
    zoomLevel = 0.15;
  }

  // 범위 비율에 따른 조정 (너무 긴 형태인 경우 더 멀리서 보기)
  if (rangeRatio > 3) zoomLevel *= 1.3;
  else if (rangeRatio > 2) zoomLevel *= 1.15;

  // 라벨 돌출 영역을 고려한 추가 조정
  zoomLevel *= 1.2;

  // 최소/최대 줌 레벨 제한
  return Math.max(0.1, Math.min(2.5, zoomLevel));
};

// 도시들을 자동으로 fit하는 카메라 위치와 줌을 계산하는 메인 함수
export const calculateAutoFitCamera = (cities: CountryData[]) => {
  const boundingBox = calculateBoundingBox(cities);
  const optimalZoom = calculateOptimalZoom(boundingBox);

  return {
    lat: boundingBox.centerLat,
    lng: boundingBox.centerLng,
    altitude: optimalZoom,
    boundingBox,
  };
};

// 현재 카메라 위치에서 타겟 위치로의 애니메이션 시간을 계산
export const calculateAnimationDuration = (
  currentLat: number,
  currentLng: number,
  currentAltitude: number,
  targetLat: number,
  targetLng: number,
  targetAltitude: number
): number => {
  // 거리 기반으로 애니메이션 시간 계산
  const distance = haversineDistance(currentLat, currentLng, targetLat, targetLng);
  const altitudeDiff = Math.abs(currentAltitude - targetAltitude);

  // 거리에 따른 시간 계산 (더 자연스럽게)
  let durationFromDistance: number;
  if (distance > 10000) {
    // 10000km 이상 (반대편 지구)
    durationFromDistance = 2000;
  } else if (distance > 5000) {
    // 5000km 이상
    durationFromDistance = 1800;
  } else if (distance > 2000) {
    // 2000km 이상
    durationFromDistance = 1500;
  } else if (distance > 1000) {
    // 1000km 이상
    durationFromDistance = 1200;
  } else if (distance > 500) {
    // 500km 이상
    durationFromDistance = 1000;
  } else {
    // 500km 이하
    durationFromDistance = 800;
  }

  // 고도 변화에 따른 시간 추가
  const altitudeTime = Math.min(altitudeDiff * 600, 800); // 최대 0.8초 추가

  // 최종 시간 계산
  const totalDuration = durationFromDistance + altitudeTime;

  // 최소 1초, 최대 3초
  return Math.max(1000, Math.min(3000, totalDuration));
};
