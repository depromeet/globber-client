"use client";

import { useEffect, useRef, useState } from "react";

import { sendGAEvent } from "@next/third-parties/google";

import type { LoadingProps } from "@/types/components";

type GlobeLoadingProps = LoadingProps & {
  selectedCount?: number;
};

export const GlobeLoading = ({ duration = 3000, onComplete, selectedCount }: GlobeLoadingProps) => {
  const isCompletedRef = useRef(false);

  const [progress, setProgress] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (selectedCount === undefined) return;
    sendGAEvent("event", "globe_generate_start", {
      flow: "onboarding",
      screen: "loading",
      selected_count: selectedCount,
    });

    return () => {
      // isCompletedRef는 DOM 노드 ref가 아닌 값 추적용 ref이므로, cleanup 시점의 최신값을 읽는 것이 의도적임

      if (isCompletedRef.current) return;

      sendGAEvent("event", "onboarding_loading_exit", {
        flow: "onboarding",
        screen: "loading",
        selected_count: selectedCount,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!duration) return;

    const completionDuration = 1000; // "완성" 표시는 1초

    const totalSteps = 99; // 1에서 100까지 99단계
    const stepDuration = duration / totalSteps; // 각 단계당 시간

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          isCompletedRef.current = true;
          setIsCompleted(true);

          // 1초 후에 완료 콜백 실행
          setTimeout(() => {
            onComplete?.();
          }, completionDuration);

          return 100;
        }
        return prev + 1;
      });
    }, stepDuration);

    return () => clearInterval(interval);
  }, [onComplete, duration]);
  return (
    <div className="w-full h-dvh relative overflow-hidden bg-linear-to-b from-[#001d39] to-[#0d0c14]">
      {/* 지구본 배경 - 중앙 정렬 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-lg aspect-square">
          {/* 방사형 그라디언트 배경을 가진 지구본 컨테이너 */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at center 81%, #000000 0%, #032f59 100%),
                        radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 15.8%, transparent 83.6%, rgba(255,255,255,0.1) 100%)`,
            }}
          >
            {/* 지구본 이미지 */}
            <div className="relative w-full h-full rounded-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/globe.webp" alt="Globe" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* 로딩 텍스트 - 중앙 정렬 */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center px-4">
          <h1 className="text-white text-[32px] font-bold leading-[42px] mb-4 whitespace-nowrap">
            {isCompleted ? "완성!" : "잠시만 기다려주세요."}
          </h1>
          <p className="text-white text-[18px] font-medium leading-[27px] text-center">지구본 생성중... {progress}%</p>
        </div>
      </div>
    </div>
  );
};
