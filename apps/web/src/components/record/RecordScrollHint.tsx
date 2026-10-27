"use client";

import { useEffect, useState } from "react";

import { ChevronDown } from "lucide-react";

type RecordScrollHintProps = {
  show: boolean;
};

export const RecordScrollHint = ({ show }: RecordScrollHintProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // 다음 프레임에서 fade in 시작
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // fade out 애니메이션 완료 후 DOM에서 제거
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none z-50 transition-opacity duration-300"
      style={{
        opacity: isVisible ? 1 : 0,
      }}
    >
      <p className="text-white/50 text-sm font-medium tracking-tight">다음 기록을 살펴보세요!</p>
      <div className="w-6 h-6 flex items-center justify-center text-white/50">
        <ChevronDown className="w-6 h-6 animate-bounce" strokeWidth={2} />
      </div>
    </div>
  );
};
