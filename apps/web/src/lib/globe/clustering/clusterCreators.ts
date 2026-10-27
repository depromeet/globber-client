/**
 * @file clusterCreators.ts
 * @description 클러스터 생성 함수들
 * @responsibility 다양한 타입의 클러스터(국가, 도시, 대륙) 생성 로직 제공
 */

import { getCountryName } from "@globber/shared/constants/countryMapping";
import type { CountryData } from "@globber/shared/types/travelPatterns";

import type { ClusterData } from "@/types/clustering";

/**
 * 국가별 클러스터 생성
 * @param locations - 위치 데이터 배열
 * @param countryThumbnails - 국가별 썸네일 URL 맵 (선택)
 * @returns 국가별로 그룹핑된 클러스터 배열
 * @responsibility 동일 국가의 도시들을 하나의 국가 클러스터로 그룹핑
 *
 * @description
 * - "몽골 5", "터키 5" 형태의 국가 클러스터 생성
 * - 각 국가의 중심점을 모든 도시의 평균 좌표로 계산
 * - 국가별 최신 썸네일이 있으면 hasRecords를 true로 설정
 *
 * @example
 * const clusters = createCountryClusters([
 *   { id: 'MN', lat: 47.8, lng: 106.9, name: '울란바토르' },
 *   { id: 'MN', lat: 48.0, lng: 107.0, name: '다르항' }
 * ]);
 * // => [{ id: 'country_MN', name: '몽골', count: 2, ... }]
 */
export const createCountryClusters = (
  locations: CountryData[],
  countryThumbnails?: Record<string, string>
): ClusterData[] => {
  const countryGroups = new Map<string, CountryData[]>();

  // 국가별로 위치 데이터 그룹핑
  locations.forEach(location => {
    const countryId = location.id;

    if (!countryGroups.has(countryId)) countryGroups.set(countryId, []);
    countryGroups.get(countryId)?.push(location);
  });

  // 각 국가별 클러스터 생성
  return Array.from(countryGroups.entries()).map(([countryId, items]) => {
    // 중심 좌표 계산 (모든 도시의 평균)
    const centerLat = items.reduce((sum, item) => sum + item.lat, 0) / items.length;
    const centerLng = items.reduce((sum, item) => sum + item.lng, 0) / items.length;
    const countryName = getCountryName(countryId);

    // 국가별 최신 썸네일 조회
    const thumbnailUrl = countryThumbnails?.[countryId];
    const hasRecords = !!thumbnailUrl;

    return {
      id: `country_${countryId}`,
      name: countryName,
      flag: items[0].flag,
      lat: centerLat,
      lng: centerLng,
      color: items[0].color,
      items,
      count: items.length,
      clusterType: "country_cluster" as const,
      hasRecords,
      thumbnailUrl,
    };
  });
};

/**
 * 개별 도시 클러스터 생성
 * @param locations - 위치 데이터 배열
 * @returns 각 도시를 개별 클러스터로 변환한 배열
 * @responsibility 각 도시를 독립적인 클러스터로 변환
 *
 * @description
 * - 국가 클러스터 클릭 시 해당 국가의 도시들을 개별 표시할 때 사용
 * - 각 도시는 고유한 ID를 가지며 (국가ID_위도_경도)
 * - clusterType을 'individual_city'로 설정
 *
 * @example
 * const cityClusters = createIndividualCityClusters([
 *   { id: 'MN', lat: 47.8, lng: 106.9, name: '울란바토르', hasRecords: true }
 * ]);
 * // => [{ id: 'MN_47.8_106.9', name: '울란바토르', clusterType: 'individual_city', ... }]
 */
export const createIndividualCityClusters = (locations: CountryData[]): ClusterData[] => {
  return locations.map(location => {
    const { id, lat, lng, name, flag, color, hasRecords, thumbnailUrl, recordCount } = location;

    return {
      id: `${id}_${lat}_${lng}`,
      name,
      flag,
      lat,
      lng,
      color,
      items: [location],
      count: 1,
      clusterType: "individual_city" as const,
      hasRecords,
      thumbnailUrl,
      recordCount,
    };
  });
};
