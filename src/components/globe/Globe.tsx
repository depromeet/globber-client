"use client";

import type React from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";
import type { GlobeInstance } from "globe.gl";

import { ZOOM_LEVELS } from "@/constants/clusteringConstants";
import { ANIMATION_DURATION, COLORS, EXTERNAL_URLS, GLOBE_CONFIG, VIEWPORT_DEFAULTS } from "@/constants/globeConfig";
import { type ClusterData, useClustering } from "@/hooks/useClustering";
import { useGlobeState } from "@/hooks/useGlobeState";
import { calculateAnimationDuration, calculateAutoFitCamera } from "@/lib/globe/autoFit";
import { createCityClickHandler, createClusterDOMClickHandler } from "@/lib/globe/eventHandlers";
import { createGlobeImageUrl } from "@/lib/globe/imageGenerator";
import {
  attachThumbnailFallback,
  calculateLabelPosition,
  type CityStyles,
  type ContinentClusterStyles,
  type CountryClusterStyles,
  createCityHTML,
  createContinentClusterHTML,
  createCountryClusterHTML,
} from "@/lib/globe/labelRenderer";
import {
  createContinentClusterStyles,
  createCountryClusterStyles,
  createSingleLabelStyles,
} from "@/lib/globe/labelStyles";
import { createZoomPreventListeners, getISOCode, getPolygonColor } from "@/lib/globe/polygonRenderer";
import type { GeoJSONFeature, PointOfView } from "@/types/geography";
import type { TravelPattern } from "@/types/travelPatterns";

const GlobeComponent = dynamic(() => import("react-globe.gl"), {
  ssr: false,
});

type GlobeProps = {
  travelPatterns: TravelPattern[];
  currentGlobeIndex: number;
  onClusterSelect?: (cluster: ClusterData) => void;
  onZoomChange?: (zoom: number) => void;
  onInteractionStart?: () => void;
  disableCityClick?: boolean;
  countryThumbnails?: Record<string, string>;
  isMyGlobe?: boolean;
  isFirstGlobe?: boolean;
  uuid?: string;
};

export interface GlobeRef {
  globeRef: React.RefObject<GlobeInstance | null>;
  resetGlobe: () => void;
}

const Globe = forwardRef<GlobeRef, GlobeProps>(
  (
    {
      travelPatterns,
      currentGlobeIndex: _,
      onClusterSelect,
      onZoomChange,
      onInteractionStart,
      disableCityClick,
      countryThumbnails,
      isMyGlobe = true,
      isFirstGlobe = false,
      uuid,
    },
    ref
  ) => {
    const router = useRouter();

    const globeRef = useRef<GlobeInstance | null>(null);
    const isGlobeInitializedRef = useRef(false);
    const hasInteractedRef = useRef(false);

    const [globeLoading, setGlobeLoading] = useState(true);
    const [globeError, setGlobeError] = useState<string | null>(null);
    const [countriesData, setCountriesData] = useState<GeoJSONFeature[]>([]);
    const [windowSize, setWindowSize] = useState({
      width: typeof window !== "undefined" ? window.innerWidth : VIEWPORT_DEFAULTS.WIDTH,
      height: typeof window !== "undefined" ? window.innerHeight : VIEWPORT_DEFAULTS.HEIGHT,
    });

    // Globe state 관리
    const {
      zoomLevel,
      selectedClusterData,
      snapZoomTo,
      currentPattern,
      topCountryCities, // topCountry는 초기화 이후 필요한 경우 다른 컴포넌트에서 사용 가능
      updateZoomLevel,
      handleSelectedDataChange,
      handleSnapZoomChange,
      resetGlobeState,
    } = useGlobeState(travelPatterns);

    // 클러스터링 시스템 사용
    const {
      visibleItems,
      handleClusterSelect,
      handleZoomChange,
      handleGlobeRotation,
      resetGlobe: resetClustering,
    } = useClustering({
      countries: currentPattern?.countries || [],
      zoomLevel,
      selectedClusterData: selectedClusterData || undefined,
      globeRef,
      onSelectedDataChange: handleSelectedDataChange,
      onSnapZoomChange: handleSnapZoomChange,
      countryThumbnails,
    });

    // 부모 컴포넌트에 globeRef와 리셋 함수들 노출
    useImperativeHandle(ref, () => ({
      globeRef,
      resetGlobe: () => {
        resetGlobeState();
        resetClustering();
      },
    }));

    const globeImageUrl = createGlobeImageUrl();

    // HTML 요소 렌더링
    const getHtmlElement = useCallback(
      (d: unknown) => {
        const clusterData = d as ClusterData;

        // SSR 환경에서는 빈 div 반환
        if (typeof window === "undefined" || typeof document === "undefined")
          return new Proxy({} as HTMLDivElement, {
            get: () => () => {},
          });

        const el = document.createElement("div");
        // HTML 컨테이너는 정확히 지구본의 좌표에 위치 (0,0 기준점)
        el.style.position = "absolute";
        el.style.top = "0px";
        el.style.left = "0px";
        el.style.width = "0px";
        el.style.height = "0px";
        el.style.overflow = "visible";
        el.style.pointerEvents = "none"; // 컨테이너는 이벤트 차단
        el.style.zIndex = "999";
        attachThumbnailFallback(el);

        const { angleOffset, dynamicDistance } = calculateLabelPosition(
          clusterData,

          visibleItems as ClusterData[]
        );

        let styles: CityStyles | ContinentClusterStyles | CountryClusterStyles;

        // ClusterData의 hasRecords 확인
        const hasRecords = clusterData.hasRecords ?? false;
        // 타인의 지구본이거나 최초 지구본이고 기록이 없는 경우 우측 패딩 12px, 그 외는 30px
        const shouldHidePlusButton = (!isMyGlobe || isFirstGlobe) && !hasRecords;
        const rightPadding = shouldHidePlusButton ? 12 : 30;

        if (clusterData.clusterType === "continent_cluster") {
          styles = createContinentClusterStyles(0, angleOffset, dynamicDistance);
        } else if (clusterData.clusterType === "country_cluster") {
          styles = createCountryClusterStyles(0, angleOffset, dynamicDistance, rightPadding);
        } else {
          // 개별 도시는 기존 스타일 유지
          styles = createSingleLabelStyles(0, angleOffset, dynamicDistance, rightPadding);
        }

        if (clusterData.clusterType === "individual_city") {
          // 개별 도시 표시
          const cityName = clusterData.name.split(",")[0];
          // ClusterData 자체의 값 사용
          const cityHasRecords = clusterData.hasRecords ?? false;
          const thumbnailUrl = clusterData.thumbnailUrl;
          const cityId = clusterData.items?.[0]?.cityId;
          const recordCount = clusterData.recordCount;

          el.innerHTML = createCityHTML(
            styles as CityStyles,
            clusterData.flag,
            cityName,
            cityHasRecords,
            thumbnailUrl,
            isMyGlobe,
            isFirstGlobe,
            recordCount
          );

          // 타인의 지구본에서 기록이 없는 경우 클릭 비활성화
          const shouldDisableClick = !isMyGlobe && !cityHasRecords;

          if (!shouldDisableClick) {
            el.addEventListener("click", () => {
              if (cityHasRecords) {
                sendGAEvent("event", "home_globe_city_detail", {
                  flow: "home",
                  screen: isMyGlobe ? "globe_main" : "globe_other",
                  click_code: isMyGlobe ? "home.globe.city.detail" : "home.other.globe.city.detail",
                });
              } else {
                sendGAEvent("event", "home_record_add", {
                  flow: "home",
                  screen: "globe_main",
                  click_code: "home.globe.city.add",
                  entry: "globe_city",
                });
              }
            });
            const clickHandler = createCityClickHandler(
              clusterData.name,
              cityId,
              cityHasRecords,
              path => router.push(path),
              disableCityClick,
              uuid
            );
            el.addEventListener("click", clickHandler);
          }
        } else if (clusterData.clusterType === "continent_cluster") {
          // 대륙 클러스터 표시 (텍스트로 +숫자)
          el.innerHTML = createContinentClusterHTML(styles as ContinentClusterStyles, clusterData.name);

          // 대륙 클러스터 클릭 시 국가 클러스터로 쪼개기
          // clusteredData.find()는 배열 순서 변경 시 잘못된 클러스터를 반환할 수 있으므로
          // 클로저에 캡처된 clusterData를 직접 사용
          const clickHandler = createClusterDOMClickHandler(clusterData.id, () => {
            sendGAEvent("event", "home_globe_continent_select", {
              flow: "home",
              screen: isMyGlobe ? "globe_main" : "globe_other",
              click_code: isMyGlobe ? "home.globe.continent.select" : "home.other.globe.continent.select",
            });

            const cluster = clusterData;
            if (cluster && handleClusterSelect && globeRef.current) {
              const clusterItems = handleClusterSelect(cluster);
              onClusterSelect?.(cluster);

              // 국가별로 그룹핑하여 각 국가의 중심점 계산
              const countryGroups = new Map<string, typeof clusterItems>();
              clusterItems.forEach(item => {
                if (!countryGroups.has(item.id)) {
                  countryGroups.set(item.id, []);
                }
                countryGroups.get(item.id)?.push(item);
              });

              // 각 국가의 중심점
              const countryCenters = Array.from(countryGroups.values()).map(countryItems => {
                const centerLat = countryItems.reduce((sum, item) => sum + item.lat, 0) / countryItems.length;
                const centerLng = countryItems.reduce((sum, item) => sum + item.lng, 0) / countryItems.length;
                return {
                  ...countryItems[0],
                  lat: centerLat,
                  lng: centerLng,
                };
              });

              // 국가들이 모두 보이도록 자동 줌인
              const autoFitCamera = calculateAutoFitCamera(countryCenters);
              const currentPov = globeRef.current.pointOfView();

              const animationDuration = calculateAnimationDuration(
                currentPov.lat || 0,
                currentPov.lng || 0,
                currentPov.altitude || 2.5,
                autoFitCamera.lat,
                autoFitCamera.lng,
                autoFitCamera.altitude
              );

              globeRef.current.pointOfView(
                {
                  lat: autoFitCamera.lat,
                  lng: autoFitCamera.lng,
                  altitude: autoFitCamera.altitude,
                },
                animationDuration
              );
            }
          });
          el.addEventListener("click", clickHandler);
        } else if (clusterData.clusterType === "country_cluster") {
          // 국가 클러스터 표시 (원 안의 숫자)
          // ClusterData 자체의 hasRecords와 thumbnailUrl 사용
          const countryHasRecords = clusterData.hasRecords ?? false;
          const thumbnailUrl = clusterData.thumbnailUrl;

          el.innerHTML = createCountryClusterHTML(
            styles as CountryClusterStyles,
            clusterData.name,
            clusterData.count,
            clusterData.flag,
            countryHasRecords,
            thumbnailUrl,
            isMyGlobe,
            isFirstGlobe
          );

          const clickHandler = createClusterDOMClickHandler(clusterData.id, (clusterId: string) => {
            sendGAEvent("event", "home_globe_country_select", {
              flow: "home",
              screen: isMyGlobe ? "globe_main" : "globe_other",
              click_code: isMyGlobe ? "home.globe.country.select" : "home.other.globe.country.select",
            });

            const cluster = (visibleItems as ClusterData[]).find(({ id }) => id === clusterId);
            if (cluster && handleClusterSelect) {
              const clusterItems = handleClusterSelect(cluster);
              onClusterSelect?.(cluster);

              // 자동 fit 기능: 클러스터의 도시들이 모두 보이도록 카메라 이동
              if (clusterItems && clusterItems.length > 0 && globeRef.current) {
                const autoFitCamera = calculateAutoFitCamera(clusterItems);
                const currentPov = globeRef.current.pointOfView();

                const animationDuration = calculateAnimationDuration(
                  currentPov.lat || 0,
                  currentPov.lng || 0,
                  currentPov.altitude || 2.5,
                  autoFitCamera.lat,
                  autoFitCamera.lng,
                  autoFitCamera.altitude
                );

                // 부드러운 카메라 이동
                globeRef.current.pointOfView(
                  {
                    lat: autoFitCamera.lat,
                    lng: autoFitCamera.lng,
                    altitude: autoFitCamera.altitude,
                  },
                  animationDuration
                );
              }
            }
          });
          el.addEventListener("click", clickHandler);
        }

        return el;
      },
      [visibleItems, handleClusterSelect, onClusterSelect, router, disableCityClick, isFirstGlobe, isMyGlobe, uuid]
    );

    // 줌 변경 핸들러
    const handleZoomChangeInternal = useCallback(
      (pov: PointOfView) => {
        if (pov && typeof pov.altitude === "number") {
          let newZoom = pov.altitude;

          // 줌 범위 제한
          if (newZoom < GLOBE_CONFIG.MIN_ZOOM) {
            newZoom = GLOBE_CONFIG.MIN_ZOOM;
            if (globeRef.current) {
              globeRef.current.pointOfView({ altitude: GLOBE_CONFIG.MIN_ZOOM }, 0);
            }
          } else if (newZoom > ZOOM_LEVELS.DEFAULT) {
            newZoom = ZOOM_LEVELS.DEFAULT;
            if (globeRef.current) {
              globeRef.current.pointOfView({ altitude: ZOOM_LEVELS.DEFAULT }, 0);
            }
          }

          // 외부에서 스냅 지시가 있으면 해당 값으로 고정
          if (typeof snapZoomTo === "number") {
            newZoom = snapZoomTo;
            if (globeRef.current) {
              globeRef.current.pointOfView({ altitude: newZoom }, 0);
            }
          }

          // 줌 레벨 상태 업데이트
          updateZoomLevel(newZoom);
          // 클러스터링 모드 전환 및 스냅 복원 처리
          handleZoomChange(newZoom);
          // 초기 카메라 애니메이션 완료 후에만 외부로 알림 (중간값 노이즈 제거)
          // isZoomed는 updateZoomLevel 이후 다음 렌더에서 반영되므로 직접 계산해서 전달
          if (isGlobeInitializedRef.current) {
            if (!hasInteractedRef.current) {
              hasInteractedRef.current = true;
              onInteractionStart?.();
            }
            const outVal = newZoom < ZOOM_LEVELS.ZOOM_THRESHOLD ? newZoom : ZOOM_LEVELS.DEFAULT;
            onZoomChange?.(outVal);
          }
        }

        // 지구본 회전 감지
        if (pov && typeof pov.lat === "number" && typeof pov.lng === "number") {
          handleGlobeRotation(pov.lat, pov.lng);
        }
      },
      [updateZoomLevel, handleZoomChange, snapZoomTo, onZoomChange, onInteractionStart, handleGlobeRotation]
    );

    // 국가 데이터 로드
    useEffect(() => {
      const loadCountries = async () => {
        try {
          setGlobeLoading(true);
          setGlobeError(null);

          const response = await fetch(EXTERNAL_URLS.WORLD_GEOJSON);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const countriesData = await response.json();
          const features = countriesData?.features || [];

          setCountriesData(features);
          setGlobeLoading(false);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          setGlobeError(`국가 데이터 로드 실패: ${errorMessage}`);
          setGlobeLoading(false);
          setCountriesData([]);
        }
      };

      loadCountries();
    }, []);

    // 윈도우 리사이즈 감지
    useEffect(() => {
      if (typeof window === "undefined") return;

      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Globe 초기 설정
    useEffect(() => {
      if (typeof window === "undefined") return;

      // Timer 변수들을 배열로 관리
      const timers: NodeJS.Timeout[] = [];

      // Globe가 완전히 로드될 때까지 반복적으로 시도
      let attempts = 0;
      const maxAttempts = 50; // 최대 5초까지 시도 (100ms * 50)

      const trySetupControls = () => {
        if (globeRef.current && !globeLoading) {
          // 초기 앵커링: Top 1 국가로 카메라 포커싱
          let initialLat = 0;
          let initialLng = 0;

          if (topCountryCities && topCountryCities.length > 0) {
            // Top 1 국가의 중심 좌표 계산
            const centerLat = topCountryCities.reduce((sum, city) => sum + city.lat, 0) / topCountryCities.length;
            const centerLng = topCountryCities.reduce((sum, city) => sum + city.lng, 0) / topCountryCities.length;

            initialLat = centerLat;
            initialLng = centerLng;
          }

          // 카메라 초기화
          globeRef.current.pointOfView(
            { lat: initialLat, lng: initialLng, altitude: ZOOM_LEVELS.DEFAULT },
            ANIMATION_DURATION.INITIAL_SETUP
          );

          // 줌 제한 설정
          try {
            const controls = globeRef.current.controls();
            if (controls) {
              controls.minDistance = GLOBE_CONFIG.MIN_DISTANCE;
              controls.maxDistance = GLOBE_CONFIG.MAX_DISTANCE;
              controls.enableZoom = true;
              controls.zoomSpeed = 0.5;
              // 초기 카메라 애니메이션 완료 후 onZoomChange 활성화
              const initTimer = setTimeout(() => {
                isGlobeInitializedRef.current = true;
              }, ANIMATION_DURATION.INITIAL_SETUP + 200);
              timers.push(initTimer);
              return; // 성공, 더 이상 시도하지 않음
            }
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.error("Error accessing controls:", error);
            }
          }
        }

        // Globe가 준비되지 않았으면 다시 시도
        attempts++;
        if (attempts < maxAttempts) {
          const nextTimer = setTimeout(trySetupControls, 100);
          timers.push(nextTimer);
        }
      };

      // 첫 번째 시도
      const initialTimer = setTimeout(trySetupControls, ANIMATION_DURATION.SETUP_DELAY);
      timers.push(initialTimer);

      const { preventZoom, preventKeyboardZoom, preventTouchZoom } = createZoomPreventListeners();

      document.addEventListener("wheel", preventZoom, { passive: false });
      document.addEventListener("keydown", preventKeyboardZoom);
      document.addEventListener("touchstart", preventTouchZoom, {
        passive: false,
      });

      return () => {
        document.removeEventListener("wheel", preventZoom);
        document.removeEventListener("keydown", preventKeyboardZoom);
        document.removeEventListener("touchstart", preventTouchZoom);
        // 모든 타이머 정리
        timers.forEach(timer => {
          clearTimeout(timer);
        });
      };
    }, [globeLoading, topCountryCities]);

    if (globeLoading) {
      return <div></div>;
    }

    if (globeError) {
      return (
        <div
          style={{
            width: GLOBE_CONFIG.WIDTH,
            height: GLOBE_CONFIG.HEIGHT,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #2c3e50 0%, #1a252f 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "14px",
            textAlign: "center",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div>⚠️ 지구본 로딩 실패</div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>인터넷 연결을 확인해주세요</div>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GlobeComponent
          ref={globeRef as React.RefObject<GlobeInstance>}
          width={windowSize.width}
          height={windowSize.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={globeImageUrl}
          showAtmosphere={true}
          atmosphereColor={COLORS.ATMOSPHERE}
          atmosphereAltitude={GLOBE_CONFIG.ATMOSPHERE_ALTITUDE}
          polygonsData={countriesData}
          polygonCapColor={(feature: unknown) =>
            getPolygonColor(feature as GeoJSONFeature, currentPattern?.countries || [], getISOCode)
          }
          polygonSideColor={() => COLORS.POLYGON_SIDE}
          polygonStrokeColor={() => COLORS.POLYGON_STROKE}
          polygonAltitude={GLOBE_CONFIG.POLYGON_ALTITUDE}
          htmlElementsData={visibleItems as ClusterData[]}
          htmlElement={getHtmlElement}
          htmlAltitude={() => 0}
          enablePointerInteraction={true}
          onZoom={handleZoomChangeInternal}
        />
      </div>
    );
  }
);

Globe.displayName = "Globe";

export default Globe;
