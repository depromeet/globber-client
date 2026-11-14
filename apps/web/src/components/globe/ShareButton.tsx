"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sendGAEvent } from "@next/third-parties/google";

import ShareIcon from "@/assets/icons/share.svg";
import { Button } from "@/components/common/Button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/Dialog";
import { toast } from "@/components/common/GlobalToast";
import { Input } from "@/components/common/Input";
import { cn } from "@/utils/cn";
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
  // React 훅
  const [isShared, setIsShared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  // 변수
  const generateShareUrl = useCallback(() => {
    if (url) return url;
    if (typeof window === "undefined") return "";

    const { uuid } = getAuthInfo();
    if (!uuid) return window.location.href;

    const baseUrl = window.location.origin;
    return `${baseUrl}/globe/${uuid}`;
  }, [url]);

  const shareUrl = generateShareUrl();
  const shareLabel = isFirstGlobe ? "내 지구본 자랑하기" : "공유하기";

  // 함수
  const copyToClipboard = useCallback(async () => {
    try {
      setIsLoading(true);

      await navigator.clipboard.writeText(shareUrl);

      // 복사 성공 피드백
      setIsShared(true);
      toast.success("링크가 복사되었습니다!");
      setTimeout(() => setIsShared(false), 2000);
    } catch {
      // 클립보드를 쓸 수 없는 환경(HTTPS가 아닌 접속, 일부 인앱 브라우저)이나 권한 거부: 주소를 직접 복사하도록 안내
      setManualCopyUrl(shareUrl);
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

  // 커스텀 훅 / 라이프사이클 훅
  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  return (
    <>
      <button
        ref={shareButtonRef}
        type="button"
        onClick={handleShare}
        disabled={isLoading}
        className={cn(
          "flex items-center justify-center transition-all hover:opacity-80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          isFirstGlobe
            ? "w-full px-12 py-[17px] rounded-2xl bg-[#00d9ff]"
            : "p-2.5 rounded-[500px] size-14 bg-surface-placeholder--8"
        )}
        aria-label={isShared ? "공유 완료" : isLoading ? "공유 중..." : shareLabel}
      >
        {isFirstGlobe ? (
          <p className="font-bold text-base text-black leading-[1.3]">
            {isShared ? "공유 완료!" : "내 지구본 자랑하기"}
          </p>
        ) : (
          <ShareIcon className={`w-8 h-8 ${isLoading ? "animate-pulse" : ""}`} />
        )}
      </button>
      <Dialog open={manualCopyUrl !== null} onOpenChange={open => !open && setManualCopyUrl(null)}>
        <DialogContent
          className="w-11/12"
          ariaDescription={null}
          onCloseAutoFocus={event => {
            event.preventDefault();
            shareButtonRef.current?.focus();
          }}
        >
          <DialogBody>
            <DialogHeader>
              <DialogTitle>링크 복사에 실패했어요</DialogTitle>
              <DialogDescription>아래 주소를 직접 복사해 주세요.</DialogDescription>
            </DialogHeader>
            <Input aria-label="공유 주소" className="text-base" readOnly value={manualCopyUrl ?? ""} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" size="lg">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
