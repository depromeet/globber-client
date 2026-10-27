import { useCallback, useEffect, useMemo, useState } from "react";

import { COUNTRY_CODE_TO_FLAG } from "@globber/shared/constants/countryMapping";
import type { CountryData, TravelPattern } from "@globber/shared/types/travelPatterns";

import { ZOOM_LEVELS } from "@/constants/clusteringConstants";

export const useGlobeState = (patterns: TravelPattern[]) => {
  const currentGlobeIndex = 0; // 항상 첫 번째 패턴만 사용

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_LEVELS.DEFAULT);
  const [selectedClusterData, setSelectedClusterData] = useState<CountryData[] | null>(null);
  const [snapZoomTo, setSnapZoomTo] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // 여행 패턴에 플래그 추가
  const travelPatternsWithFlags: TravelPattern[] = useMemo(
    () =>
      patterns.map(pattern => ({
        ...pattern,
        countries: pattern.countries.map(c => ({
          ...c,
          flag: COUNTRY_CODE_TO_FLAG[c.id] || "",
        })),
      })),
    [patterns]
  );

  const currentPattern = useMemo(() => travelPatternsWithFlags[currentGlobeIndex], [travelPatternsWithFlags]);

  /**
   * Top 1 국가 선택 로직:
   * 1. city_count가 가장 많은 국가(Top 1)를 선택
   * 2. 동률 발생 시 최근에 기록(updatedAt)된 도시가 포함된 국가를 우선 선정
   *
   * mapper에서 이미 cityCount와 updatedAt을 준비했으므로,
   * 국가별 유일한 데이터 하나를 선택하여 정렬만 수행합니다.
   */
  const topCountry = useMemo(() => {
    if (!currentPattern?.countries || currentPattern.countries.length === 0) return null;

    // 국가별로 유일한 데이터 추출 (각 국가당 1개만 필요 - cityCount는 동일)
    const uniqueCountries = Array.from(new Map(currentPattern.countries.map(c => [c.id, c])).values());

    // 예외 처리: 1개 국가만 있으면 해당 국가 반환
    if (uniqueCountries.length === 1) return uniqueCountries[0];

    // mapper에서 준비한 cityCount와 updatedAt으로 정렬
    // NOTE: updatedAt은 백엔드에서 도시별 기록 시간을 제공할 때까지 설정되지 않음
    // 현재는 cityCount 기준으로만 Top 1을 선정하며, updatedAt이 추가되면 동률 처리도 적용됨
    const countryStats = uniqueCountries.map(country => ({
      country,
      cityCount: country.cityCount ?? 1,
      latestTime: country.updatedAt ? new Date(country.updatedAt).getTime() : 0,
    }));

    // city_count로 정렬하여 Top 1 찾기
    countryStats.sort((a, b) => {
      // city_count 내림차순
      if (b.cityCount !== a.cityCount) return b.cityCount - a.cityCount;

      // 동률 시 최근 기록 시간
      // updatedAt이 없으면 latestTime = 0이므로 자동으로 이 기준은 미적용됨
      return b.latestTime - a.latestTime;
    });

    return countryStats[0]?.country ?? null;
  }, [currentPattern]);

  /**
   * Top 1 국가의 모든 도시 데이터 (초기 앵커링 시 사용)
   */
  const topCountryCities = useMemo(() => {
    if (!topCountry || !currentPattern?.countries) return null;

    return currentPattern.countries.filter(({ id }) => id === topCountry.id);
  }, [topCountry, currentPattern]);

  // 핸들러 함수들
  const handleCountrySelect = useCallback((countryId: string | null) => {
    setSelectedCountry(countryId);
  }, []);

  /**
   * 줌 레벨 state 업데이트 (단순 setter)
   * 클러스터링 모드 전환 및 스냅 복원은 useClustering이 담당
   */
  const updateZoomLevel = useCallback((newZoomLevel: number) => {
    const rounded = Number(newZoomLevel.toFixed(2));
    const isCurrentlyZoomed = rounded < ZOOM_LEVELS.ZOOM_THRESHOLD;

    setZoomLevel(rounded);
    setIsZoomed(isCurrentlyZoomed);
  }, []);

  /**
   * 선택 클러스터 데이터 변경 콜백 (useClustering이 호출)
   */
  const handleSelectedDataChange = useCallback((data: CountryData[] | null) => {
    setSelectedClusterData(data);
  }, []);

  /**
   * 스냅 줌 변경 콜백 (useClustering이 호출)
   */
  const handleSnapZoomChange = useCallback((zoom: number | null) => {
    setSnapZoomTo(zoom);
  }, []);

  // snapZoomTo가 설정되면 120ms 후 자동 해제 (Globe가 영구 고정되지 않도록)
  useEffect(() => {
    if (typeof snapZoomTo !== "number") return;

    const t = setTimeout(() => setSnapZoomTo(null), 120);
    return () => clearTimeout(t);
  }, [snapZoomTo]);

  const resetGlobeState = useCallback(() => {
    setSelectedCountry(null);
    setSelectedClusterData(null);
    setZoomLevel(ZOOM_LEVELS.DEFAULT);
    setSnapZoomTo(null);
    setIsZoomed(false);
  }, []);

  return {
    // State
    selectedCountry,
    currentGlobeIndex,
    zoomLevel,
    selectedClusterData,
    snapZoomTo,
    isZoomed,
    travelPatternsWithFlags,
    currentPattern,
    topCountry,
    topCountryCities,

    // Handlers
    handleCountrySelect,
    updateZoomLevel,
    handleSelectedDataChange,
    handleSnapZoomChange,
    resetGlobeState,
  };
};
