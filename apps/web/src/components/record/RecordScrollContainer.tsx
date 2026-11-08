"use client";

import { isValidElement, type ReactNode, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";

const SWIPE_IGNORED_SELECTOR = 'button, a, [role="button"], input, textarea, [data-emoji-reactions]';

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

  // 버튼·링크·입력이나 이모지 반응 영역에서 시작한 스와이프는 기록 넘김으로 처리하지 않는다
  const isSwipeIgnoredRef = useRef(false);

  // 스와이프 핸들러 (터치·마우스 모두 여기서만 처리해 한 번의 스와이프가 한 번만 넘기도록 한다)
  const swipeHandlers = useSwipeable({
    onTouchStartOrOnMouseDown: ({ event }) => {
      const target = event.target;
      isSwipeIgnoredRef.current = target instanceof Element && Boolean(target.closest(SWIPE_IGNORED_SELECTOR));
    },
    onSwipedUp: () => {
      if (isSwipeIgnoredRef.current) return;
      if (hasNext && !isTransitioning) {
        onIndexChange(currentIndex + 1);
      }
    },
    onSwipedDown: () => {
      if (isSwipeIgnoredRef.current) return;
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
