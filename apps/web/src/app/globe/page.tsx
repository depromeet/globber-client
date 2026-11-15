"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import type { TravelPattern } from "@globber/shared/types/travelPatterns";
import { mapGlobeDataToTravelPatterns } from "@globber/shared/utils/globeDataMapper";
import { sendGAEvent } from "@next/third-parties/google";

import Error500Icon from "@/assets/icons/500_error.webp";
import { BackButton, Button } from "@/components/common/Button";
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

// 로딩 애니메이션이 끝난 뒤 데이터를 더 기다리는 최대 시간
const DATA_WAIT_LIMIT_MS = 10_000;

type DataStatus = "loading" | "loaded" | "failed";

type GlobeLoadErrorProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

/** 온보딩 지구본 데이터를 불러오지 못했을 때 흐름을 끊지 않고 그 자리에서 다시 시도하게 하는 안내 (GLB-177) */
const GlobeLoadError = ({ isRetrying, onRetry }: GlobeLoadErrorProps) => (
  <div className="w-full h-dvh flex items-center justify-center px-4">
    <div role="alert" className="w-full max-w-sm flex flex-col items-center gap-8">
      <div className="w-32 h-32 relative">
        <Image src={Error500Icon} alt="" fill className="object-contain" />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold leading-8 text-text-primary">지구본을 불러오지 못했어요</h1>
        <p className="text-base font-medium leading-6 text-text-secondary">
          네트워크 상태를 확인하고
          <br />
          잠시 후 다시 시도해주세요.
        </p>
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "불러오는 중..." : "다시 시도"}
      </Button>
    </div>
  </div>
);

const GlobeContent = () => {
  const globeRef = useRef<GlobeRef | null>(null);
  const searchParams = useSearchParams();
  const selectedCount = searchParams.get("count") ? Number(searchParams.get("count")) : undefined;

  const [travelPatterns, setTravelPatterns] = useState<TravelPattern[]>([]);
  // 로딩 애니메이션과 데이터 요청이 모두 끝나야 결과 화면을 보여 준다
  const [isLoadingAnimationDone, setIsLoadingAnimationDone] = useState(false);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [isRetrying, setIsRetrying] = useState(false);
  const isLoading = !isLoadingAnimationDone || dataStatus === "loading";
  const [travelInsight, setTravelInsight] = useState<string>("");
  const [cityCount, setCityCount] = useState<number>(0);
  const [countryCount, setCountryCount] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hasClusterSelected, setHasClusterSelected] = useState(false);

  const hasBackButton = isZoomed || hasClusterSelected;
  const hasViewedResultRef = useRef(false);
  // 페이지를 떠날 때 로딩 화면이 아직 떠 있었는지 판단하기 위한 값
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // 로딩 완료 콜백
  const handleLoadingComplete = useCallback(() => setIsLoadingAnimationDone(true), []);

  // 응답이 오지 않아도 로딩 화면에 계속 머물지 않도록, 애니메이션이 끝난 뒤에는 정해진 시간까지만 기다리고 실패 안내로 넘긴다.
  // 늦게라도 응답이 오면 loadData가 상태를 loaded로 바꿔 지구본을 보여 준다.
  useEffect(() => {
    if (!isLoadingAnimationDone || dataStatus !== "loading") return;
    const timer = setTimeout(
      () => setDataStatus(current => (current === "loading" ? "failed" : current)),
      DATA_WAIT_LIMIT_MS
    );
    return () => clearTimeout(timer);
  }, [isLoadingAnimationDone, dataStatus]);

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
      // 로딩 화면에서 떠남: 애니메이션이 끝났어도 결과 화면으로 넘어가기 전이면 로딩 중 이탈로 본다
      if (isLoadingRef.current) {
        sendGAEvent("event", "onboarding_loading_exit", {
          flow: "onboarding",
          screen: "loading",
          selected_count: selectedCount,
        });
        return;
      }
      if (hasViewedResultRef.current)
        sendGAEvent("event", "onboarding_globeresult_exit", {
          flow: "onboarding",
          screen: "globeresult",
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인한 사용자의 데이터 로드. 지구본 데이터를 받지 못하면 실패로 본다 (인사이트 문구는 없어도 지구본은 보여 준다)
  const loadData = useCallback(async () => {
    try {
      const { uuid, memberId } = getAuthInfo();

      if (!uuid || !memberId) {
        setDataStatus("loaded");
        return;
      }

      // 서버 오류(5xx)도 오류 화면으로 이동하지 않고 이 화면에서 다시 시도하게 한다. 401은 그대로 로그인 만료 화면으로 보낸다
      const globeResponse = await getGlobeData(uuid, undefined, true, { skipServerErrorRedirect: true });
      if (!globeResponse?.data) {
        setDataStatus("failed");
        return;
      }

      // 인사이트 문구는 없어도 지구본은 보여 준다
      const insightResponse = await getTravelInsight(parseInt(memberId, 10), true, { skipServerErrorRedirect: true });

      setTravelPatterns(mapGlobeDataToTravelPatterns(globeResponse.data));
      setCityCount(globeResponse.data.cityCount);
      setCountryCount(globeResponse.data.countryCount);
      setTravelInsight(insightResponse || "");
      setDataStatus("loaded");
    } catch {
      setDataStatus("failed");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await loadData();
    setIsRetrying(false);
  }, [loadData]);

  // 로딩 중이거나 데이터가 없는 경우
  if (isLoading) return <GlobeLoading onComplete={handleLoadingComplete} selectedCount={selectedCount} />;

  if (dataStatus === "failed") return <GlobeLoadError isRetrying={isRetrying} onRetry={handleRetry} />;

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
        <div className="absolute bottom-6.5 left-0 right-0 z-10 px-4">
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
