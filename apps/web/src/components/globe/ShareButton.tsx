"use client";

import { useCallback, useEffect, useState } from "react";

import { sendGAEvent } from "@next/third-parties/google";

import ShareIcon from "@/assets/icons/share.svg";
import { getAuthInfo } from "@/utils/cookies";

type ShareButtonProps = {
  /**
   * 공유할 URL (기본값: 현재 페이지 URL)
   */
  url?: string;
  /**
   * 첫 지구본 여부 (true일 경우 큰 버튼 스타일)
   */
  isFirstGlobe?: boolean;
  /**
   * home_share_click 이벤트의 screen 파라미터 (globe_main | list_main)
   */
  screen?: string;
};

export const ShareButton = ({ url, isFirstGlobe = false, screen }: ShareButtonProps) => {
  // React Hooks
  const [isShared, setIsShared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Variables
  const generateShareUrl = useCallback(() => {
    if (url) return url;
    if (typeof window === "undefined") return "";

    const { uuid } = getAuthInfo();
    if (!uuid) return window.location.href;

    const baseUrl = window.location.origin;
    return `${baseUrl}/globe/${uuid}`;
  }, [url]);

  const shareUrl = generateShareUrl();

  // Functions
  const copyToClipboard = useCallback(async () => {
    try {
      setIsLoading(true);

      await navigator.clipboard.writeText(shareUrl);

      // 복사 성공 피드백
      setIsShared(true);
      alert("링크가 복사되었습니다!");
      setTimeout(() => setIsShared(false), 2000);
    } finally {
      setIsLoading(false);
    }
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    if (isFirstGlobe)
      sendGAEvent("event", "globeresult_share_click", {
        flow: "onboarding",
        screen: "globeresult",
        click_code: "onboarding.globeresult.cta.share",
      });

    if (screen)
      sendGAEvent("event", "home_share_click", {
        flow: "home",
        screen,
        click_code: "home.bottom.action.share",
      });

    // 모바일 기기 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    );

    // PC 또는 Web Share API 미지원: 클립보드 복사
    if (!isSupported || !isMobile) {
      await copyToClipboard();
      return;
    }

    // 모바일: Web Share API 사용
    try {
      setIsLoading(true);

      await navigator.share({
        url: shareUrl,
      });

      // 공유 성공 피드백
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);
    } catch (error) {
      // 사용자가 공유를 취소한 경우 (AbortError)는 에러로 처리하지 않음
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 공유 실패 시 클립보드 복사로 폴백
      await copyToClipboard();
    } finally {
      setIsLoading(false);
    }
  }, [isFirstGlobe, screen, isSupported, shareUrl, copyToClipboard]);

  // Custom Hooks / Lifecycle Hooks
  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // 첫 지구본일 때는 큰 버튼 스타일
  if (isFirstGlobe) {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={isLoading}
        className="w-full flex items-center justify-center px-12 py-[17px] rounded-2xl bg-[#00d9ff] transition-all hover:opacity-80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={isShared ? "공유 완료" : isLoading ? "공유 중..." : "내 지구본 자랑하기"}
      >
        <p className="font-bold text-base text-black leading-[1.3]">{isShared ? "공유 완료!" : "내 지구본 자랑하기"}</p>
      </button>
    );
  }

  // 기본 아이콘 버튼 스타일
  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isLoading}
      className="flex items-center justify-center p-2.5 rounded-[500px] size-14 bg-surface-placeholder--8 transition-all hover:opacity-80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={isShared ? "공유 완료" : isLoading ? "공유 중..." : "공유하기"}
    >
      <ShareIcon className={`w-8 h-8 ${isLoading ? "animate-pulse" : ""}`} />
    </button>
  );
};
