"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import type { TravelPattern } from "@globber/shared/types/travelPatterns";
import { mapGlobeDataToTravelPatterns } from "@globber/shared/utils/globeDataMapper";
import { sendGAEvent } from "@next/third-parties/google";

import { BackButton } from "@/components/common/Button";
import type { GlobeRef } from "@/components/globe/Globe";
import { GlobeFooter } from "@/components/globe/GlobeFooter";
import { GlobeHeader } from "@/components/globe/GlobeHeader";
import { GlobeLoading } from "@/components/loading/GlobeLoading";
import { ZOOM_LEVELS } from "@/constants/clusteringConstants";
import { getGlobeData, getTravelInsight } from "@/services/memberService";
import { getAuthInfo } from "@/utils/cookies";

const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <div></div>,
});

const GlobeContent = () => {
  const globeRef = useRef<GlobeRef | null>(null);
  const searchParams = useSearchParams();
  const selectedCount = searchParams.get("count") ? Number(searchParams.get("count")) : undefined;

  const [travelPatterns, setTravelPatterns] = useState<TravelPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [travelInsight, setTravelInsight] = useState<string>("");
  const [cityCount, setCityCount] = useState<number>(0);
  const [countryCount, setCountryCount] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hasClusterSelected, setHasClusterSelected] = useState(false);

  const hasBackButton = isZoomed || hasClusterSelected;
  const hasViewedResultRef = useRef(false);

  // 로딩 완료 콜백
  const handleLoadingComplete = useCallback(() => setIsLoading(false), []);

  useEffect(() => {
    if (isLoading || travelPatterns.length === 0) return;
    hasViewedResultRef.current = true;
    sendGAEvent("event", "onboarding_globeresult_view", {
      flow: "onboarding",
      screen: "globeresult",
    });
  }, [isLoading, travelPatterns.length]);

  useEffect(() => {
    if (selectedCount === undefined) return;
    return () => {
      if (hasViewedResultRef.current)
        sendGAEvent("event", "onboarding_globeresult_exit", {
          flow: "onboarding",
          screen: "globeresult",
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인한 사용자의 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const { uuid, memberId } = getAuthInfo();

        if (!uuid || !memberId) {
          setIsLoading(false);
          return;
        }

        const globeResponse = await getGlobeData(uuid);
        const insightResponse = await getTravelInsight(parseInt(memberId, 10));

        if (globeResponse?.data) {
          const mappedPatterns = mapGlobeDataToTravelPatterns(globeResponse.data);

          setTravelPatterns(mappedPatterns);
          setCityCount(globeResponse.data.cityCount);
          setCountryCount(globeResponse.data.countryCount);
        }

        setTravelInsight(insightResponse || "");
      } catch {
        // 에러 처리
      }
    };

    loadData();
  }, []);

  // 로딩 중이거나 데이터가 없는 경우
  if (isLoading) return <GlobeLoading onComplete={handleLoadingComplete} selectedCount={selectedCount} />;

  if (travelPatterns.length === 0)
    return (
      <div className="w-full h-dvh flex items-center justify-center">
        <div className="text-white text-xl text-center">
          <div>🌍 여행 데이터가 없습니다</div>
          <div className="text-sm text-gray-400 mt-2">사진을 업로드하여 여행 기록을 만들어보세요</div>
        </div>
      </div>
    );

  return (
    <div className="w-full overflow-hidden text-text-primary relative flex flex-col h-dvh">
      <div className="absolute inset-0">
        {/* 상단 헤더 - position absolute */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-20">
          <GlobeHeader
            isZoomed={hasBackButton}
            travelInsight={travelInsight}
            cityCount={cityCount}
            countryCount={countryCount}
          />
        </div>

        {/* Country Based Globe 컴포넌트 - 전체 화면 사용 */}
        <div className="w-full h-full">
          <Globe
            ref={globeRef}
            travelPatterns={travelPatterns}
            currentGlobeIndex={0}
            onZoomChange={zoom => {
              const zoomed = zoom < ZOOM_LEVELS.ZOOM_THRESHOLD;
              setIsZoomed(zoomed);
              if (!zoomed) setHasClusterSelected(false);
            }}
            onInteractionStart={() => {
              sendGAEvent("event", "globe_interaction_start", {
                flow: "onboarding",
                screen: "globeresult",
              });
            }}
            onClusterSelect={() => setHasClusterSelected(true)}
            disableCityClick={true}
            isFirstGlobe={true}
          />
        </div>

        {/* 하단 버튼들 - position absolute */}
        <div className="absolute bottom-[26px] left-0 right-0 z-10 px-4">
          <GlobeFooter isZoomed={hasBackButton} isFirstGlobe={true} />
        </div>

        {/* 돌아가기 버튼 */}
        <BackButton
          isZoomed={hasBackButton}
          globeRef={globeRef}
          onReset={() => {
            setIsZoomed(false);
            setHasClusterSelected(false);
          }}
        />
      </div>
    </div>
  );
};

const GlobePrototype = () => {
  return (
    <Suspense fallback={<GlobeLoading />}>
      <GlobeContent />
    </Suspense>
  );
};

export default GlobePrototype;
