/**
 * @file eventHandlers.ts
 * @description Globe 이벤트 핸들러 팩토리 함수들
 * @responsibility 클러스터 선택, 회전, 줌 이벤트 핸들러 생성 로직 제공
 */

import type React from "react";

import type { CountryData } from "@globber/shared/types/travelPatterns";

import {
  AUTO_CLUSTER_DELAY,
  CONTINENT_MODE_ZOOM_MULTIPLIER,
  ROTATION_SMOOTHING_FACTOR,
  ROTATION_UPDATE_THRESHOLD,
  ZOOM_ANIMATION_DURATION,
  ZOOM_LEVELS,
} from "@/constants/clusteringConstants";
import type { ClusterData, ClusteringState } from "@/types/clustering";

import { isSignificantRotation } from "./calculations";

/**
 * 클러스터 모드 전환 핸들러 생성
 * @param setState - 클러스터링 상태 업데이트 함수
 * @param setSelectionStack - 선택 스택 업데이트 함수
 * @param setLastRotation - 마지막 회전 위치 업데이트 함수
 * @param selectedClusterData - 현재 선택된 클러스터 데이터
 * @param currentZoomRef - 현재 줌 레벨 ref (stale closure 방지)
 * @param setZoomStack - 줌 스택 업데이트 함수
 * @param onSelectedDataChange - 선택 데이터 변경 콜백
 * @returns 클러스터 선택 핸들러 함수
 * @responsibility 클러스터 클릭 시 모드 전환 및 상태 업데이트
 *
 * @description
 * - continent_cluster 클릭: 국가 모드로 전환하고 스택에 추가
 * - country_cluster 클릭: 도시 모드로 전환하고 줌 애니메이션 실행
 * - individual_city 클릭: 해당 도시의 items 반환
 */
export const createClusterTransitionHandler = (
  setState: React.Dispatch<React.SetStateAction<ClusteringState>>,
  setSelectionStack: React.Dispatch<React.SetStateAction<(CountryData[] | null)[]>>,
  selectedClusterData: CountryData[] | undefined,
  currentZoomRef: React.RefObject<number>,
  setZoomStack: React.Dispatch<React.SetStateAction<number[]>>,
  onSelectedDataChange: (data: CountryData[] | null) => void,
  zoomAnimTimerRef: React.MutableRefObject<NodeJS.Timeout | null>
) => {
  return (cluster: ClusterData) => {
    const { clusterType, items, id } = cluster;

    // 대륙 클러스터 클릭 시
    if (clusterType === "continent_cluster") {
      // 클러스터에 속한 국가 ID 추출 → continent_cluster 재병합 방지용
      const countryIds = new Set(items.map(item => item.id));

      setState(prev => ({
        ...prev,
        mode: "country",
        expandedCountry: null,
        selectedCluster: null,
        clickBasedExpansion: false,
        lastInteraction: Date.now(),
        expandedContinentCountryIds: countryIds,
      }));

      return items;
    }

    // 국가 클러스터 클릭 시
    if (clusterType === "country_cluster") {
      setState(prev => ({
        ...prev,
        mode: "city",
        expandedCountry: id.replace("country_", ""),
        selectedCluster: id,
        clickBasedExpansion: true,
        lastInteraction: Date.now(),
        isZoomAnimating: true,
      }));

      // 줌 애니메이션 완료 후 isZoomAnimating false로 설정
      if (zoomAnimTimerRef.current) clearTimeout(zoomAnimTimerRef.current);
      zoomAnimTimerRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isZoomAnimating: false,
        }));
      }, ZOOM_ANIMATION_DURATION);

      setZoomStack(prev => [...prev, currentZoomRef.current]);
      setSelectionStack(stack => [...stack, selectedClusterData || null]);
      onSelectedDataChange(items);

      return items;
    }

    return items;
  };
};

type GlobeRotationRefs = {
  modeRef: React.RefObject<string>;
  selectedClusterRef: React.RefObject<string | null>;
  lastRotationRef: React.RefObject<{ lat: number; lng: number }>;
  isZoomAnimatingRef: React.RefObject<boolean>;
};

/**
 * 지구본 회전 핸들러 생성
 * @param setState - 클러스터링 상태 업데이트 함수
 * @param setSelectionStack - 선택 스택 업데이트 함수
 * @param setLastRotation - 마지막 회전 위치 업데이트 함수
 * @param refs - 최신 상태를 읽기 위한 ref 객체 묶음
 * @param onSelectionStackChange - 선택 스택 변경 콜백 (선택)
 * @returns 회전 핸들러 함수
 * @responsibility 지구본 회전 감지 및 모드 전환 처리
 *
 * @description
 * - 줌 애니메이션 중에는 회전 무시
 * - 도시 모드에서 의미있는 회전 감지 시 국가 모드로 복귀
 * - 일반 모드에서는 부드러운 회전 추적만 수행
 * - refs를 통해 항상 최신 상태값을 읽어 stale closure 방지
 */
export const createGlobeRotationHandler = (
  setState: React.Dispatch<React.SetStateAction<ClusteringState>>,
  setSelectionStack: React.Dispatch<React.SetStateAction<(CountryData[] | null)[]>>,
  setLastRotation: React.Dispatch<React.SetStateAction<{ lat: number; lng: number }>>,
  refs: GlobeRotationRefs,
  onSelectionStackChange?: (newStack: (CountryData[] | null)[]) => void,
  rotationTimerRef?: React.MutableRefObject<NodeJS.Timeout | null>,
  setZoomStack?: React.Dispatch<React.SetStateAction<number[]>>
) => {
  return (lat: number, lng: number) => {
    const { modeRef, selectedClusterRef, lastRotationRef, isZoomAnimatingRef } = refs;

    const mode = modeRef.current;
    const selectedCluster = selectedClusterRef.current;
    const { lat: lastLat, lng: lastLng } = lastRotationRef.current;
    const isZoomAnimating = isZoomAnimatingRef.current;

    // 줌 애니메이션 중에는 회전 이벤트 무시
    if (isZoomAnimating) return;

    // 도시 모드에서 회전 감지
    if (mode === "city" && selectedCluster) {
      const isRotated = isSignificantRotation(lat, lng, lastLat, lastLng);

      if (isRotated) {
        if (rotationTimerRef?.current) clearTimeout(rotationTimerRef.current);

        const timer = setTimeout(() => {
          // 모드를 국가로 변경, 대륙 클러스터 확장 상태도 초기화
          setState(prev => ({
            ...prev,
            mode: "country",
            expandedCountry: null,
            selectedCluster: null,
            clickBasedExpansion: false,
            lastInteraction: Date.now(),
            expandedContinentCountryIds: new Set(),
          }));

          // 선택 스택 되돌리기
          setSelectionStack(stack => {
            const newStack = stack.length === 0 ? stack : stack.slice(0, -1);
            if (onSelectionStackChange) onSelectionStackChange(newStack);
            return newStack;
          });

          // zoomStack도 selectionStack과 함께 pop하여 동기화 (급격한 zoom out 방지)
          if (setZoomStack) {
            setZoomStack(s => (s.length === 0 ? s : s.slice(0, -1)));
          }
        }, AUTO_CLUSTER_DELAY);

        if (rotationTimerRef) rotationTimerRef.current = timer;
        setLastRotation({ lat, lng });
      }
    } else {
      // 일반 모드에서는 부드러운 회전 추적
      const latDiff = Math.abs(lat - lastLat);
      const lngDiff = Math.abs(lng - lastLng);

      if (latDiff > ROTATION_UPDATE_THRESHOLD || lngDiff > ROTATION_UPDATE_THRESHOLD) {
        setLastRotation(prev => ({
          lat: prev.lat + (lat - prev.lat) * ROTATION_SMOOTHING_FACTOR,
          lng: prev.lng + (lng - prev.lng) * ROTATION_SMOOTHING_FACTOR,
        }));
      }
    }
  };
};

type ZoomHandlerRefs = {
  zoomStackRef: React.RefObject<number[]>;
  selectionStackRef: React.RefObject<(CountryData[] | null)[]>;
  prevZoomRef: React.RefObject<number>;
  modeRef: React.RefObject<string>;
};

/**
 * 줌 변경 핸들러 생성
 * @param setState - 클러스터링 상태 업데이트 함수
 * @param setZoomStack - 줌 스택 업데이트 함수
 * @param setSelectionStack - 선택 스택 업데이트 함수
 * @param refs - 최신 상태를 읽기 위한 ref 객체 묶음 (stale closure 방지)
 * @param onSnapZoomChange - 스냅 줌 변경 콜백
 * @param onSelectedDataChange - 선택 데이터 변경 콜백
 * @returns 줌 변경 핸들러 함수
 * @responsibility 줌 레벨에 따른 모드 전환 및 스냅 복원 처리
 *
 * @description
 * - 도시 모드에서는 줌 변경 무시 (클릭으로만 제어)
 * - 일정 줌 레벨 이상이면 대륙 모드로 전환 및 스택 초기화
 * - 줌아웃 감지 + 스택이 있으면 직전 단계로 스냅 복원
 * - refs를 통해 항상 최신 상태값을 읽어 stale closure 방지
 */
export const createZoomChangeHandler = (
  setState: React.Dispatch<React.SetStateAction<ClusteringState>>,
  setZoomStack: React.Dispatch<React.SetStateAction<number[]>>,
  setSelectionStack: React.Dispatch<React.SetStateAction<(CountryData[] | null)[]>>,
  refs: ZoomHandlerRefs,
  onSnapZoomChange: (zoom: number | null) => void,
  onSelectedDataChange: (data: CountryData[] | null) => void
) => {
  return (newZoomLevel: number) => {
    const rounded = Number(newZoomLevel.toFixed(2));
    const zoomStack = refs.zoomStackRef.current;

    // 도시 모드에서는 줌 변경 무시
    if (refs.modeRef.current === "city") return { newZoom: rounded };

    // 일정 줌 레벨 이상이면 대륙 모드로 전환
    if (rounded >= ZOOM_LEVELS.DEFAULT * CONTINENT_MODE_ZOOM_MULTIPLIER) {
      setState(prev => ({
        ...prev,
        mode: "continent",
        expandedCountry: null,
        selectedCluster: null,
        clickBasedExpansion: false,
        expandedContinentCountryIds: new Set(),
      }));
      setZoomStack([]);
      setSelectionStack([]);
      onSelectedDataChange(null);
      onSnapZoomChange(null);

      return { reset: true };
    }

    // 줌아웃 감지 + 스택이 있으면 직전 단계로 스냅 복원
    if (rounded > refs.prevZoomRef.current + ZOOM_LEVELS.THRESHOLDS.ZOOM_DETECTION && zoomStack.length > 0) {
      const last = zoomStack[zoomStack.length - 1];
      const currentSelectionStack = refs.selectionStackRef.current;
      const newSelectionStack =
        currentSelectionStack.length === 0 ? currentSelectionStack : currentSelectionStack.slice(0, -1);
      const parent = newSelectionStack.length > 0 ? newSelectionStack[newSelectionStack.length - 1] : null;

      // 줌아웃으로 상위 단계 복귀 시 대륙 클러스터 확장 상태 초기화
      setState(prev => ({ ...prev, expandedContinentCountryIds: new Set() }));
      onSnapZoomChange(last);
      onSelectedDataChange(parent);
      setZoomStack(s => s.slice(0, -1));
      setSelectionStack(newSelectionStack);

      return { snapped: true };
    }

    return { newZoom: rounded };
  };
};

// ============================================
// DOM 클릭 핸들러
// ============================================

/**
 * 클러스터 클릭 핸들러 생성
 * @param clusterId - 클릭된 클러스터 ID
 * @param onClusterClick - 클러스터 클릭 콜백
 * @returns 클릭 이벤트 핸들러
 * @responsibility DOM 클릭 이벤트 차단 및 클러스터 콜백 위임
 */
export const createClusterDOMClickHandler = (clusterId: string, onClusterClick: (clusterId: string) => void) => {
  return (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    onClusterClick(clusterId);
  };
};

/**
 * 도시 클릭 시 이동할 경로 생성
 * @param cityName - 도시명 (형식: "도시명, 국가명")
 * @param cityId - 도시 ID
 * @param hasRecords - 기록 존재 여부
 * @param uuid - 사용자 UUID (선택)
 * @returns 이동할 경로
 * @responsibility 기록 유무에 따른 이동 경로 결정
 *
 * @description
 * - 기록 있음: 엔드뷰(상세 기록)로 이동
 * - 기록 없음: 기록하기 페이지로 이동
 */
export const buildCityNavigationPath = (
  cityName: string,
  cityId?: number,
  hasRecords: boolean = true,
  uuid?: string
): string => {
  if (hasRecords && cityId) return uuid ? `/record/${cityId}?uuid=${uuid}` : `/record/${cityId}`;

  const parts = cityName.split(",").map(s => s.trim());
  const params = new URLSearchParams();
  if (cityId) params.set("cityId", String(cityId));
  params.set("city", parts[0]);
  params.set("country", parts[1] || "");

  return `/image-metadata?${params.toString()}`;
};

/**
 * 도시 클릭 핸들러 생성
 * @param cityName - 도시명 (형식: "도시명, 국가명")
 * @param cityId - 도시 ID
 * @param hasRecords - 기록 존재 여부
 * @param onNavigate - 네비게이션 콜백
 * @param disableCityClick - 도시 클릭 비활성화 여부
 * @param uuid - 사용자 UUID (선택)
 * @returns 클릭 이벤트 핸들러
 * @responsibility 도시 DOM 클릭 이벤트 처리 및 페이지 이동
 *
 * @description
 * - 기록 있음: 상세 기록 뷰로 이동
 * - 기록 없음: 기록하기 페이지로 이동
 * - disableCityClick이 true면 클릭 무시
 */
export const createCityClickHandler = (
  cityName: string,
  cityId?: number,
  hasRecords: boolean = true,
  onNavigate?: (path: string) => void,
  disableCityClick?: boolean,
  uuid?: string
) => {
  return (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (disableCityClick) return;

    const path = buildCityNavigationPath(cityName, cityId, hasRecords, uuid);

    if (onNavigate) onNavigate(path);
    else window.location.href = path;
  };
};
