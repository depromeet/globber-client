"use client";

import { isValidElement, type ReactNode, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";

type RecordScrollContainerProps = {
  children: ReactNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  hasNext: boolean;
  hasPrevious: boolean;
};

export const RecordScrollContainer = ({
  children,
  currentIndex,
  onIndexChange,
  hasNext,
  hasPrevious,
}: RecordScrollContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 스와이프 핸들러
  const swipeHandlers = useSwipeable({
    onSwipedUp: () => {
      if (hasNext && !isTransitioning) {
        onIndexChange(currentIndex + 1);
      }
    },
    onSwipedDown: () => {
      if (hasPrevious && !isTransitioning) {
        onIndexChange(currentIndex - 1);
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
    delta: 50,
  });

  // 휠 이벤트 핸들러
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWheelTime = 0;
    const THROTTLE_DELAY = 150;

    const handleWheel = (e: WheelEvent) => {
      // 이모지 영역에서 발생한 wheel 이벤트는 무시
      const target = e.target as HTMLElement;
      if (target.closest("[data-emoji-reactions]")) {
        return;
      }

      e.preventDefault();

      if (isTransitioning) return;

      const now = Date.now();
      if (now - lastWheelTime < THROTTLE_DELAY) return;

      lastWheelTime = now;
      const deltaY = e.deltaY;

      if (deltaY > 0 && hasNext) {
        // 아래로 스크롤
        onIndexChange(currentIndex + 1);
      } else if (deltaY < 0 && hasPrevious) {
        // 위로 스크롤
        onIndexChange(currentIndex - 1);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [currentIndex, hasNext, hasPrevious, isTransitioning, onIndexChange]);

  // 터치 스크롤 핸들러 (모바일)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStart = 0;
    let touchEnd = 0;
    let touchStartTime = 0;
    let isTouchMoved = false;
    let isInteractiveTouch = false;

    const handleTouchStart = (e: TouchEvent) => {
      // 버튼이나 인터랙티브 요소를 터치한 경우 스크롤 방지
      const target = e.target as HTMLElement;
      const interactiveTarget =
        target.closest("button") ||
        target.closest("a") ||
        target.closest('[role="button"]') ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("[data-emoji-reactions]");
      isInteractiveTouch = Boolean(interactiveTarget);
      if (isInteractiveTouch) {
        return;
      }

      touchStart = e.touches[0].clientY;
      touchStartTime = Date.now();
      isTouchMoved = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isInteractiveTouch) return;
      touchEnd = e.touches[0].clientY;
      isTouchMoved = true;
    };

    const handleTouchEnd = () => {
      if (isInteractiveTouch) {
        isInteractiveTouch = false;
        return;
      }
      if (isTransitioning || !isTouchMoved) return;

      const diff = touchStart - touchEnd;
      const threshold = 50;
      const touchDuration = Date.now() - touchStartTime;

      // 너무 빠른 터치는 무시 (실수로 스크롤 방지)
      if (touchDuration < 100) return;

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && hasNext) {
          // 위로 스와이프 (다음 기록)
          onIndexChange(currentIndex + 1);
        } else if (diff < 0 && hasPrevious) {
          // 아래로 스와이프 (이전 기록)
          onIndexChange(currentIndex - 1);
        }
      }

      isInteractiveTouch = false;
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentIndex, hasNext, hasPrevious, isTransitioning, onIndexChange]);

  // 인덱스 변경 시 애니메이션

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  return (
    <div
      role="region"
      aria-label="Record scroll container"
      ref={node => {
        containerRef.current = node;
        if (swipeHandlers.ref) {
          (swipeHandlers.ref as (node: HTMLDivElement | null) => void)(node);
        }
      }}
      onMouseDown={swipeHandlers.onMouseDown}
      className="w-full h-full overflow-hidden relative"
      style={{
        touchAction: "pan-y",
      }}
    >
      <div
        className="w-full h-full transition-transform duration-500 ease-out"
        style={{
          transform: `translateY(-${currentIndex * 100}%)`,
        }}
      >
        {children.map((child, index) => {
          const key = isValidElement(child) && child.key ? child.key : `record-${index}`;
          return (
            <div key={key} className="w-full h-dvh">
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
};
