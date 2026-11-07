import { cn } from "@/utils/cn";

type GlobeHeaderProps = {
  isZoomed: boolean;
  travelInsight?: string;
  cityCount?: number;
  countryCount?: number;
};

// 마크다운 문법 제거 함수
const removeMarkdown = (text?: string) => {
  if (!text) return "";

  // **텍스트** 패턴에서 ** 제거
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
};

export const GlobeHeader = ({ isZoomed, travelInsight, cityCount = 0, countryCount = 0 }: GlobeHeaderProps) => {
  return (
    <div
      className={cn(
        "text-center pb-4 transition-opacity duration-700 ease-out max-w-lg mx-auto pt-2.5",
        isZoomed ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div
        style={{
          background: "radial-gradient(95.88% 89.71% at 17.16% 14.06%, #00D9FF 0%, #60E7FF 56.15%, #C6F6FF 100%)",
        }}
        className={cn(
          "inline-flex items-center rounded-lg px-3 py-1 text-[13px] font-bold mb-3 text-[#001326] transition-all duration-500 delay-100 tracking-[-0.26px] leading-normal",
          isZoomed ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
      >
        {removeMarkdown(travelInsight) || "AI 인사이트 준비중..."}
      </div>
      <h1
        className={cn(
          "text-xl font-extrabold text-text-primary transition-all duration-600 delay-200",
          isZoomed ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
      >
        {cityCount}개 도시, {countryCount}개국 여행자
      </h1>
    </div>
  );
};
