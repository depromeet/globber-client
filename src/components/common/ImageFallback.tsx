import { ImageOff } from "lucide-react";

import { IMAGE_LOAD_ERROR_MESSAGE } from "@/constants/image";
import { cn } from "@/utils/cn";

type ImageFallbackProps = {
  /**
   * - `sm`: 작은 썸네일용. 아이콘만 표시합니다.
   * - `md`: 사진 편집 카드용. 아이콘과 안내 문구 한 줄을 표시합니다.
   * - `lg`: 엔드뷰 전체 화면용. 아이콘, 안내 문구, 보조 문구를 표시합니다.
   */
  size?: "sm" | "md" | "lg";
  /** `sm`일 때 아이콘 크기(px) */
  iconSize?: number;
  className?: string;
};

/**
 * 이미지 로드에 실패한 자리에 보여 주는 폴백입니다.
 * 부모 요소를 가득 채우므로 부모에 크기를 지정해야 합니다.
 */
export const ImageFallback = ({ size = "sm", iconSize = 12, className }: ImageFallbackProps) => {
  if (size === "sm") {
    return (
      <div
        role="img"
        aria-label={IMAGE_LOAD_ERROR_MESSAGE}
        className={cn("w-full h-full flex items-center justify-center bg-gray-750 text-gray-400", className)}
      >
        <ImageOff size={iconSize} strokeWidth={2} aria-hidden />
      </div>
    );
  }

  if (size === "md") {
    return (
      <div
        className={cn(
          "w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-800 text-gray-200",
          className
        )}
      >
        <ImageOff size={32} strokeWidth={2} aria-hidden />
        <p className="text-sm font-medium text-text-secondary">{IMAGE_LOAD_ERROR_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("w-full h-full flex flex-col items-center justify-center gap-3.5 pb-15 text-gray-200", className)}
      style={{ background: "radial-gradient(120% 70% at 50% 42%, #112036 0%, #001326 70%)" }}
    >
      <ImageOff size={40} strokeWidth={2} aria-hidden />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base font-semibold text-text-primary">{IMAGE_LOAD_ERROR_MESSAGE}</p>
        <p className="text-sm font-medium text-text-secondary">잠시 후 다시 확인해 주세요</p>
      </div>
    </div>
  );
};
