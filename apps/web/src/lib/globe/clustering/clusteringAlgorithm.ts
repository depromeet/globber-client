/**
 * @file clusteringAlgorithm.ts
 * @description 메인 클러스터링 알고리즘
 * @responsibility 줌 레벨과 모드에 따른 동적 클러스터링 로직 제공
 */

import type React from "react";

import { getContinent } from "@globber/shared/constants/countryMapping";
import type { CountryData } from "@globber/shared/types/travelPatterns";
import type { GlobeInstance } from "globe.gl";

import {
  EFFECTIVE_WIDTH_RATIO,
  GEO_DISTANCE_THRESHOLD,
  OVERLAP_THRESHOLD_RATIO,
} from "@/constants/clusteringConstants";
import { estimateBubbleWidth, haversineDistance } from "@/lib/globe/calculations";
import type { ClusterData } from "@/types/clustering";

import { createCountryClusters, createIndividualCityClusters } from "./clusterCreators";

/**
 * 메인 클러스터링 로직
 * @param locations - 위치 데이터 배열
 * @param globeRef - Globe 인스턴스 참조
 * @param mode - 클러스터링 모드 ('country' | 'city' | 'continent')
 * @param expandedCountry - 확장된 국가 ID (city 모드에서 사용)
 * @param countryThumbnails - 국가별 썸네일 URL 맵
 * @returns 클러스터 데이터 배열
 * @responsibility 현재 모드와 화면 상태에 따른 최적의 클러스터링 수행
 *
 * @description
 * 클러스터링 시스템:
 * 1. 대륙 ↔ 국가: 줌 레벨에 따라 동적 변경
 * 2. 국가 → 도시: 클릭으로만 제어 (줌 레벨 무관)
 * 3. 지구본 회전 시: 도시 모드에서 국가 모드로 자동 복귀
 *
 * 알고리즘:
 * 1. 도시 모드: 선택된 국가의 도시들만 개별 표시
 * 2. 국가 모드: 국가별로 그룹핑 후 화면 겹침 분석
 * 3. 겹치는 국가들을 BFS로 찾아서 서브클러스터링
 * 4. 지리적으로 가까운 국가들끼리 대륙 클러스터로 병합
 */
export const clusterLocations = (
  locations: CountryData[],
  globeRef: React.RefObject<GlobeInstance | null>,
  mode: "country" | "city" | "continent" = "country",
  expandedCountry: string | null = null,
  countryThumbnails?: Record<string, string>,
  expandedContinentCountryIds?: ReadonlySet<string>
): ClusterData[] => {
  if (!locations || locations.length === 0) return [];

  // ============================================
  // 1. 도시 모드: 클릭된 국가의 도시들만 개별 표시
  // ============================================
  if (mode === "city" && expandedCountry) {
    const countryLocations = locations.filter(({ id }) => id === expandedCountry);
    return createIndividualCityClusters(countryLocations);
  }

  // ============================================
  // 2. Globe 준비 확인
  // ============================================
  if (!globeRef.current || typeof globeRef.current.getScreenCoords !== "function")
    return createCountryClusters(locations, countryThumbnails);

  // Globe 좌표 변환 기능 검증
  try {
    const testPos = globeRef.current.getScreenCoords(0, 0);
    if (!testPos || typeof testPos.x !== "number" || typeof testPos.y !== "number")
      return createCountryClusters(locations, countryThumbnails);
  } catch {
    return createCountryClusters(locations, countryThumbnails);
  }

  // ============================================
  // 3. 국가 클러스터 생성 및 화면 좌표 계산
  // ============================================
  const globe = globeRef.current;
  const countryClusters = createCountryClusters(locations, countryThumbnails);

  // 각 클러스터의 화면 좌표와 버블 너비 계산
  const clustersWithPos = countryClusters
    .map(cluster => {
      const screenPos = globe.getScreenCoords(cluster.lat, cluster.lng);
      const bubbleWidth = estimateBubbleWidth(cluster);

      return {
        ...cluster,
        screenPos,
        width: bubbleWidth,
        effectiveWidth: bubbleWidth * EFFECTIVE_WIDTH_RATIO, // 겹침 판단용 유효 너비
      };
    })
    .filter(
      ({ screenPos }) =>
        screenPos &&
        typeof screenPos.x === "number" &&
        typeof screenPos.y === "number" &&
        !Number.isNaN(screenPos.x) &&
        !Number.isNaN(screenPos.y)
    );

  // ============================================
  // 4. BFS로 화면에서 겹치는 클러스터 그룹 찾기
  // ============================================
  const processedIds = new Set<string>();
  const finalClusters: ClusterData[] = [];

  for (let i = 0; i < clustersWithPos.length; i++) {
    const startCluster = clustersWithPos[i];
    if (processedIds.has(startCluster.id)) continue;

    // BFS로 연결된 모든 겹치는 클러스터 찾기
    const overlappingClusters = [startCluster];
    const queue = [startCluster];
    processedIds.add(startCluster.id);

    let head = 0;
    while (head < queue.length) {
      const currentCluster = queue[head++];

      for (let j = 0; j < clustersWithPos.length; j++) {
        const candidateCluster = clustersWithPos[j];
        if (processedIds.has(candidateCluster.id)) continue;

        // 화면 거리 계산
        const distance = Math.hypot(
          currentCluster.screenPos.x - candidateCluster.screenPos.x,
          currentCluster.screenPos.y - candidateCluster.screenPos.y
        );

        // 겹침 판단: 두 클러스터의 유효 너비 합의 일정 비율보다 가까우면 겹침
        const overlapThreshold =
          (currentCluster.effectiveWidth + candidateCluster.effectiveWidth) * OVERLAP_THRESHOLD_RATIO;

        if (distance < overlapThreshold) {
          processedIds.add(candidateCluster.id);
          queue.push(candidateCluster);
          overlappingClusters.push(candidateCluster);
        }
      }
    }

    // ============================================
    // 5. 겹치는 클러스터가 2개 이상이면 서브클러스터링
    // ============================================
    if (overlappingClusters.length > 1) {
      // 지리적 거리 기반 서브클러스터링
      const subClusters: ClusterData[][] = [];
      const processedInSubCluster = new Set<string>();

      for (const cluster of overlappingClusters) {
        if (processedInSubCluster.has(cluster.id)) continue;

        const subCluster = [cluster];
        processedInSubCluster.add(cluster.id);

        // 현재 클러스터와 지리적으로 가까운 다른 클러스터 찾기
        for (const candidate of overlappingClusters) {
          if (processedInSubCluster.has(candidate.id)) continue;

          // 하버신 공식으로 실제 거리 계산
          const distance = haversineDistance(cluster.lat, cluster.lng, candidate.lat, candidate.lng);

          if (distance < GEO_DISTANCE_THRESHOLD) {
            subCluster.push(candidate);
            processedInSubCluster.add(candidate.id);
          }
        }

        subClusters.push(subCluster);
      }

      // ============================================
      // 6. 각 서브클러스터를 대륙별로 그룹핑
      // ============================================
      subClusters.forEach(subCluster => {
        if (subCluster.length > 1) {
          // 대륙별로 그룹핑 (근접한 국가들끼리만)
          const continentGroups = new Map<string, typeof subCluster>();

          subCluster.forEach(cluster => {
            const continent = getContinent(cluster.items[0].id);
            if (!continentGroups.has(continent)) continentGroups.set(continent, []);

            (continentGroups.get(continent) as ClusterData[]).push(cluster);
          });

          // 각 대륙 그룹을 대륙 클러스터로 변환
          // Map.forEach 콜백 순서: (value, key) — Array.forEach와 반대!
          continentGroups.forEach((group, continent) => {
            // 그룹 내 국가 중 하나라도 대륙 클러스터 확장 대상이면 개별 표시
            const hasExpandedCountry =
              expandedContinentCountryIds &&
              expandedContinentCountryIds.size > 0 &&
              group.some(({ items }) => expandedContinentCountryIds.has(items[0]?.id ?? ""));

            if (group.length > 1 && !hasExpandedCountry) {
              // 2개 이상의 국가가 있으면 대륙 클러스터 생성
              const allItems = group.flatMap(({ items }) => items);
              const uniqueCountries = [...new Set(allItems.map(({ id }) => id))];

              // 가중 평균으로 중심 좌표 계산 (도시 개수에 비례)
              let totalWeight = 0;
              let weightedLat = 0;
              let weightedLng = 0;

              group.forEach(({ count, lat, lng }) => {
                const weight = count;
                weightedLat += lat * weight;
                weightedLng += lng * weight;
                totalWeight += weight;
              });

              const centerLat = weightedLat / totalWeight;
              const centerLng = weightedLng / totalWeight;

              // 가장 많은 도시를 가진 국가의 플래그 사용
              const representativeCluster = group.reduce((prev, current) =>
                prev.count > current.count ? prev : current
              );

              const continentCluster: ClusterData = {
                id: `continent_${continent}_${uniqueCountries.sort().join("_")}`,
                name: `${continent} +${uniqueCountries.length}`,
                flag: representativeCluster.flag,
                lat: centerLat,
                lng: centerLng,
                color: representativeCluster.color,
                items: allItems,
                count: allItems.length,
                clusterType: "continent_cluster" as const,
              };

              finalClusters.push(continentCluster);
            } else {
              // 1개 국가만 있거나, 확장된 대륙 클러스터 소속 국가인 경우 개별 표시
              for (const cluster of group) finalClusters.push(cluster);
            }
          });
        } else {
          // 서브클러스터에 1개만 있으면 그대로 유지
          finalClusters.push(subCluster[0]);
        }
      });
    } else {
      // 겹치지 않으면 그대로 유지
      finalClusters.push(startCluster);
    }
  }

  return finalClusters;
};
