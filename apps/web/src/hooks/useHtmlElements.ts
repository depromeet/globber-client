import { useMemo } from "react";

import type { ClusterData } from "@globber/shared/types/globe";
import type { CountryData } from "@globber/shared/types/travelPatterns";

type UseHtmlElementsParams = {
  isAnimating: boolean;
  displayPhase: "root" | "country" | "city";
  phaseTargetRef: React.MutableRefObject<"root" | "country" | "city" | null>;
  prevZoomRef: React.MutableRefObject<number | null>;
  zoomLevel: number;
  selectedClusterData: ClusterData[] | null;
  clusteredData: ClusterData[];
  currentPatternCountries: CountryData[];
};

export const useHtmlElements = ({
  isAnimating,
  displayPhase,
  phaseTargetRef,
  prevZoomRef,
  zoomLevel,
  selectedClusterData,
  clusteredData,
  currentPatternCountries,
}: UseHtmlElementsParams) => {
  return useMemo(() => {
    if (typeof window === "undefined") return [];

    // 카메라 애니메이션 중에는 깜빡임 방지를 위해 라벨을 이전 단계로 고정
    const effectivePhase = isAnimating ? displayPhase : (phaseTargetRef.current ?? displayPhase);

    // 휠로 임계값을 넘을 때 마지막 알려진 단계로 스냅백 (히스테리시스)
    if (!isAnimating && prevZoomRef.current !== null) {
      const prev = prevZoomRef.current;
      const curr = zoomLevel;
      // 줌 인
      if (curr < prev) {
        // 줌 인할 때만 단계 진행 허용
      } else if (curr > prev) {
        // 줌 아웃: 단계를 앞으로 진행하지 않음
        // 단계 변경은 줌 핸들러 임계값에서 처리됨
      }
    }

    // 전환 간 깜빡임 방지를 위한 단계 기반 렌더링
    if (effectivePhase === "city") {
      if (selectedClusterData && selectedClusterData.length > 0) {
        return selectedClusterData.map(country => ({
          ...country,
          items: [country],
          count: 1,
        }));
      }
      // 선택 없음 -> 클러스터로 폴백
      return clusteredData;
    }

    if (effectivePhase === "country") {
      // 줌과 관계없이 클러스터 뷰 표시 (국가 레벨)
      return clusteredData;
    }

    // 루트/기본: 클러스터 뷰
    if (clusteredData.length > 0) {
      return clusteredData;
    }

    return currentPatternCountries.map(country => ({
      ...country,
      items: [country],
      count: 1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAnimating,
    displayPhase,
    phaseTargetRef.current,
    zoomLevel,
    selectedClusterData,
    clusteredData,
    currentPatternCountries,
    prevZoomRef.current,
  ]);
};
