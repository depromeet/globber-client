/**
 * @file useClustering.ts
 * @description 클러스터링 상태 관리 훅
 * @responsibility Globe의 클러스터링 모드 및 상태 관리, 이벤트 핸들러 제공
 *
 * @description
 * 클러스터링 시스템:
 * 1. 대륙 ↔ 국가: 줌 레벨에 따라 동적 변경
 * 2. 국가 → 도시: 클릭으로만 제어 (줌 레벨 무관)
 * 3. 지구본 회전 시: 도시 모드에서 국가 모드로 자동 복귀
 *
 * 스택 소유권:
 * - zoomStack, selectionStack은 이 훅이 단독 소유
 * - 상태 변경 시 onSelectedDataChange, onSnapZoomChange 콜백으로 상위에 통보
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CountryData } from "@globber/shared/types/travelPatterns";

import { clusterLocations } from "@/lib/globe/clustering/clusteringAlgorithm";
import {
  createClusterTransitionHandler,
  createGlobeRotationHandler,
  createZoomChangeHandler,
} from "@/lib/globe/eventHandlers";
import type { ClusterData, ClusteringState, UseClusteringProps } from "@/types/clustering";

/**
 * 클러스터링 훅
 * @param countries - 국가 데이터 배열
 * @param zoomLevel - 현재 줌 레벨
 * @param selectedClusterData - 선택된 클러스터 데이터
 * @param globeRef - Globe 인스턴스 참조
 * @param onSelectedDataChange - 선택 데이터 변경 콜백
 * @param onSnapZoomChange - 스냅 줌 변경 콜백
 * @param countryThumbnails - 국가별 썸네일 URL 맵
 * @returns 클러스터링 상태 및 핸들러
 * @responsibility 클러스터링 모드 관리 및 사용자 상호작용 처리
 *
 * @description
 * - 클러스터링 데이터 계산 및 캐싱
 * - 모드 전환 (continent/country/city) 관리
 * - 이벤트 핸들러 생성 및 제공
 * - 줌, 회전, 클릭 이벤트 처리
 * - zoomStack/selectionStack 단독 소유 및 콜백으로 상위 통보
 */
export const useClustering = ({
  countries,
  zoomLevel,
  selectedClusterData,
  globeRef,
  onSelectedDataChange,
  onSnapZoomChange,
  countryThumbnails,
}: UseClusteringProps) => {
  // ============================================
  // 상태 관리
  // ============================================

  const [state, setState] = useState<ClusteringState>({
    mode: "country",
    expandedCountry: null,
    selectedCluster: null,
    clusteredData: [],
    lastInteraction: Date.now(),
    clickBasedExpansion: false,
    rotationPosition: { lat: 0, lng: 0 },
    lastSignificantRotation: Date.now(),
    isZoomAnimating: false,
    expandedContinentCountryIds: new Set(),
  });

  const [zoomStack, setZoomStack] = useState<number[]>([]);
  const [selectionStack, setSelectionStack] = useState<(CountryData[] | null)[]>([]);
  const [lastRotation, setLastRotation] = useState({ lat: 0, lng: 0 });

  const {
    mode,
    selectedCluster,
    isZoomAnimating,
    expandedCountry,
    clickBasedExpansion,
    rotationPosition,
    lastSignificantRotation,
    expandedContinentCountryIds,
  } = state;

  const modeRef = useRef<string>(mode);
  const selectedClusterRef = useRef<string | null>(selectedCluster);
  const lastRotationRef = useRef<{ lat: number; lng: number }>(lastRotation);
  const isZoomAnimatingRef = useRef<boolean>(isZoomAnimating);
  const zoomLevelRef = useRef<number>(zoomLevel);
  const zoomStackRef = useRef<number[]>(zoomStack);
  const selectionStackRef = useRef<(CountryData[] | null)[]>(selectionStack);
  const zoomAnimTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);

  modeRef.current = mode;
  selectedClusterRef.current = selectedCluster;
  lastRotationRef.current = lastRotation;
  isZoomAnimatingRef.current = isZoomAnimating;
  zoomLevelRef.current = zoomLevel;
  zoomStackRef.current = zoomStack;
  selectionStackRef.current = selectionStack;

  // ============================================
  // 클러스터 데이터 계산
  // ============================================

  /**
   * 현재 상태에 따른 클러스터 데이터 계산
   * @responsibility 줌 레벨, 모드, 선택 상태에 따라 최적의 클러스터링 수행
   */
  const clusteredData = useMemo(() => {
    try {
      const dataToCluster = selectedClusterData && selectedClusterData.length > 0 ? selectedClusterData : countries;

      if (!dataToCluster || dataToCluster.length === 0) return [];

      return clusterLocations(
        dataToCluster,
        globeRef,
        mode,
        expandedCountry,
        countryThumbnails,
        expandedContinentCountryIds.size > 0 ? expandedContinentCountryIds : undefined
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("Clustering calculation failed:", error);

      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zoomLevel은 함수 본문에서 직접 참조되지 않지만, 내부의 globeRef.current.getScreenCoords()가 줌/카메라 상태에 따라 다른 화면 좌표를 반환하므로 줌 변경 시마다 재계산을 트리거하기 위해 필요
  }, [
    countries,
    zoomLevel,
    selectedClusterData,
    mode,
    expandedCountry,
    globeRef,
    countryThumbnails,
    expandedContinentCountryIds,
  ]);

  /**
   * 화면에 표시할 클러스터 아이템 (캐싱)
   */
  const visibleItems = useMemo(() => clusteredData, [clusteredData]);

  // ============================================
  // 이벤트 핸들러 생성
  // ============================================

  /**
   * 클러스터 선택 핸들러
   * @responsibility 클러스터 클릭 시 모드 전환 및 상태 업데이트
   * - 클릭 시 현재 줌/선택을 스택에 push
   */
  const handleClusterSelect = useMemo(
    () =>
      createClusterTransitionHandler(
        setState,
        setSelectionStack,
        selectedClusterData,
        zoomLevelRef,
        setZoomStack,
        onSelectedDataChange,
        zoomAnimTimerRef
      ),
    [selectedClusterData, onSelectedDataChange]
  );

  /**
   * 줌 변경 핸들러
   * @responsibility 줌 레벨에 따른 모드 전환 및 스냅 복원 처리
   */
  const handleZoomChange = useMemo(
    () =>
      createZoomChangeHandler(
        setState,
        setZoomStack,
        setSelectionStack,
        { zoomStackRef, selectionStackRef, prevZoomRef: zoomLevelRef, modeRef },
        onSnapZoomChange,
        onSelectedDataChange
      ),
    [onSnapZoomChange, onSelectedDataChange]
  );

  /**
   * 지구본 회전 핸들러
   * @responsibility 회전 감지 및 자동 모드 복귀 처리
   */
  const handleGlobeRotation = useMemo(
    () =>
      createGlobeRotationHandler(
        setState,
        setSelectionStack,
        setLastRotation,
        { modeRef, selectedClusterRef, lastRotationRef, isZoomAnimatingRef },
        newStack => {
          const parent = newStack.length > 0 ? newStack[newStack.length - 1] : null;
          onSelectedDataChange(parent);
        },
        rotationTimerRef,
        setZoomStack
      ),

    [onSelectedDataChange]
  );

  /**
   * Globe 리셋 핸들러
   * @responsibility 모든 상태를 초기값으로 리셋하고 상위에 통보
   */
  const resetGlobe = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: "country",
      expandedCountry: null,
      selectedCluster: null,
      clickBasedExpansion: false,
      rotationPosition: { lat: 0, lng: 0 },
      lastSignificantRotation: Date.now(),
      isZoomAnimating: false,
      expandedContinentCountryIds: new Set(),
    }));
    setZoomStack([]);
    setSelectionStack([]);
    onSelectedDataChange(null);
    onSnapZoomChange(null);
  }, [onSelectedDataChange, onSnapZoomChange]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- timer refs must be read at unmount time to cancel any in-flight timers
      clearTimeout(zoomAnimTimerRef.current ?? undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- timer refs must be read at unmount time to cancel any in-flight timers
      clearTimeout(rotationTimerRef.current ?? undefined);
    };
  }, []);

  // ============================================
  // 반환값
  // ============================================

  return {
    // 상태
    clusteredData,
    shouldShowClusters: true,
    mode,
    expandedCountry,
    clickBasedExpansion,

    // 데이터
    visibleItems,

    // 핸들러
    handleClusterSelect,
    handleZoomChange,
    handleGlobeRotation,
    resetGlobe,

    // 디버깅
    debug: {
      zoomStack: zoomStack.length,
      selectionStack: selectionStack.length,
      lastRotation,
      rotationPosition,
      lastSignificantRotation,
    },
  };
};

export type { ClusterData };
