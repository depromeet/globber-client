"use client";

import { Header } from "../common/Header";

interface CityErrorFallbackProps {
  onBack: () => void;
  onNavigateToCitySelection: () => void;
}

export const CityErrorFallback = ({ onBack, onNavigateToCitySelection }: CityErrorFallbackProps) => {
  return (
    <div className="max-w-md mx-auto min-h-dvh bg-black text-white">
      <Header title="도시 선택 필요" variant="dark" leftIcon="back" onLeftClick={onBack} />
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-white">도시 정보가 필요합니다.</p>
          <p className="text-sm text-white/60">
            여행 기록을 작성하려면 먼저 도시를 선택해주세요. 선택 화면으로 이동한 후 다시 시도해 주세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToCitySelection}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-black hover:opacity-90 transition-opacity"
        >
          도시 선택 화면으로 이동
        </button>
      </div>
    </div>
  );
};
