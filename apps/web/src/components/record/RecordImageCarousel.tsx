"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { sendGAEvent } from "@next/third-parties/google";
import useEmblaCarousel from "embla-carousel-react";

import { ImageFallback } from "@/components/common/ImageFallback";
import { useImageLoadError } from "@/hooks/useImageLoadError";

type RecordImageCarouselProps = {
  images: string[];
  onImageChange?: (index: number) => void;
  userInfoHeight?: number;
  isFirstRecord?: boolean;
  recordId?: string;
  isOwner?: boolean;
};

type RecordImageSlideProps = {
  src: string;
  index: number;
  scale: number;
  priority: boolean;
};

const RecordImageSlide = ({ src, index, scale, priority }: RecordImageSlideProps) => {
  const { hasError, handleError } = useImageLoadError(src);

  if (hasError) {
    return <ImageFallback size="lg" />;
  }

  return (
    <Image
      src={src}
      alt={`Record image ${index + 1}`}
      fill
      unoptimized
      sizes="(max-width: 512px) 100vw, 512px"
      className="object-cover pointer-events-none"
      style={{ transform: `scale(${scale})` }}
      priority={priority}
      draggable={false}
      onError={handleError}
    />
  );
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const RESET_DELAY_MS = 300;

export const RecordImageCarousel = ({
  images,
  onImageChange,
  userInfoHeight = 0,
  isFirstRecord = false,
  recordId = "",
  isOwner = false,
}: RecordImageCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);

  // 페이지네이션 인디케이터 위치 계산: userInfoHeight + gap(16px)
  const indicatorBottomPx = userInfoHeight + 16;

  const initialDistanceRef = useRef<number | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGestureActiveRef = useRef(false);
  const previousIndexRef = useRef<number>(-1);

  // Embla 이벤트 리스너 설정
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();

    if (previousIndexRef.current !== -1 && previousIndexRef.current !== index) {
      const screen = isOwner ? "my" : "other";
      sendGAEvent("event", isOwner ? "endview_my_photo_swipe" : "endview_other_photo_swipe", {
        flow: "endview",
        screen,
        click_code: `endview.${screen}.image.swipe`,
        record_id: recordId,
        photo_index_before: previousIndexRef.current,
        photo_index_after: index,
        photo_count: images.length,
      });
    }
    previousIndexRef.current = index;

    setCurrentIndex(index);
    setScale(1); // 슬라이드 변경 시 줌 리셋
    onImageChange?.(index);
  }, [emblaApi, onImageChange, recordId, images.length, isOwner]);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on("select", onSelect);
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // 지표에서 슬라이드 선택
  const handleIndicatorClick = useCallback(
    (index: number) => {
      if (emblaApi) {
        emblaApi.scrollTo(index);
      }
    },
    [emblaApi]
  );

  // 피치 줌 처리 (터치 제스처)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

      if (initialDistanceRef.current === null) {
        initialDistanceRef.current = currentDistance;
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
          resetTimeoutRef.current = null;
        }
      } else {
        const distanceRatio = currentDistance / initialDistanceRef.current;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, distanceRatio));
        setScale(newScale);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && isGestureActiveRef.current) {
      // 피치줌 종료
      isGestureActiveRef.current = false;
      initialDistanceRef.current = null;

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      resetTimeoutRef.current = setTimeout(() => {
        setScale(1);
        resetTimeoutRef.current = null;
      }, RESET_DELAY_MS);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      if (!isGestureActiveRef.current) {
        const screen = isOwner ? "my" : "other";
        sendGAEvent("event", isOwner ? "endview_my_photo_zoom" : "endview_other_photo_zoom", {
          flow: "endview",
          screen,
          click_code: `endview.${screen}.image.zoom`,
          record_id: recordId,
          photo_index: currentIndex,
        });
      }
      isGestureActiveRef.current = true;
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, []);

  if (images.length === 0) {
    return (
      <div className="w-full h-full bg-surface-thirdly flex items-center justify-center">
        <p className="text-text-secondary">이미지가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full select-none">
      {/* Embla Carousel 컨테이너 */}
      <div
        className="w-full h-full overflow-hidden select-none"
        ref={emblaRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex h-full">
          {images.map((src, index) => (
            <div key={`carousel-slide-${index}`} className="relative min-w-full h-full shrink-0">
              <RecordImageSlide
                src={src}
                index={index}
                scale={scale}
                priority={isFirstRecord && index === currentIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 이미지 인디케이터 (여러 장일 경우만) */}
      {images.length > 1 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 z-10"
          style={{ bottom: `${indicatorBottomPx}px` }}
        >
          {images.map((_, index) => (
            <button
              key={`indicator-${index}`}
              type="button"
              onClick={() => handleIndicatorClick(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex ? "bg-white w-1.5" : "bg-white/30 w-1.5"
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
