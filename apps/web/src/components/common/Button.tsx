import { useId, useRef, useState } from "react";
import Image from "next/image";

import { EMOJI_LIST } from "@globber/shared/constants/emoji";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Camera, X } from "lucide-react";

import ReturnIcon from "@/assets/icons/return.svg";
import { ZOOM_LEVELS } from "@/constants/clusteringConstants";
import useImage from "@/hooks/useImage";
import type { BackButtonProps } from "@/types/button";
import { cn } from "@/utils/cn";

type ImageUploadButtonProps = {
  photoType: string;
  disabled?: boolean;
  className?: string;
};

const iconButtonStyles = cn(
  "inline-flex justify-center items-center rounded-2xl outline outline-gray-200 bg-white disabled:opacity-40 text-gray-700 font-medium",
  "enabled:hover:bg-gray-50 enabled:hover:outline-gray-300 enabled:hover:text-gray-900 disabled:opacity-40"
);

export const buttonVariants = cva(
  "inline-flex justify-center items-center rounded-2xl disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-blue-theme enabled:hover:bg-blue-200 text-black",
        gray: "bg-surface-button-gray enabled:hover:bg-gray-1000 text-white",
        black: "bg-[#0C0D15] enabled:hover:bg-gray-1000 text-white",
        disabled: "bg-[#243146] enabled:hover:bg-gray-800 text-text-thirdly",
      },
      size: {
        xs: "p-1 h-6 text-xs",
        sm: "px-[8px] py-[6px] h-[30px] text-xs",
        md: "px-[10px] py-[8px] h-[36px] text-sm",
        lg: "px-[12px] py-[18px] h-[56px] text-lg font-bold rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export const iconButtonVariants = cva(iconButtonStyles, {
  variants: {
    size: {
      sm: "px-8 py-6 gap-4 text-xs",
      lg: "px-10 py-8 gap-6 text-sm",
      square: "h-36 w-36",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
};

export const IconButton = ({
  className,
  icon,
  size,
  children,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    icon: React.ReactNode;
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp data-slot="icon-button" className={cn(iconButtonVariants({ size }), className)} {...props}>
      {icon}
      {children}
    </Comp>
  );
};

export const ImageUploadButton = ({ photoType, disabled = false, className }: ImageUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { photos, handleSelectFile, handleRemove } = useImage([photoType]);

  const uploadedImage = photos[photoType]?.url || null;

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleChangeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleSelectFile(photoType)(files[0]);
    }
    e.target.value = "";
  };

  const handleRemoveClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    handleRemove(photoType)();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "relative flex w-full shrink-0 flex-col justify-center gap-4 rounded-[30px] border border-dashed border-gray-200 bg-white outline-none disabled:bg-gray-100",
          !disabled && "hover:border-gray-300 hover:bg-gray-50",
          uploadedImage ? "items-start gap-10 p-0" : "aspect-square items-center gap-4 p-16",
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        aria-label={uploadedImage ? "이미지 업로드 버튼 (이미지가 업로드됨)" : "이미지 업로드 버튼"}
      >
        {uploadedImage ? (
          <Image
            src={uploadedImage}
            alt="업로드된 이미지"
            width={90}
            height={90}
            className="flex aspect-square w-full! shrink-0 items-center gap-10 self-stretch rounded-md object-cover"
          />
        ) : (
          <>
            <Camera size={16} className={disabled ? "text-gray-400" : "text-gray-700"} />
            {/* <span className={cn("text-xs font-medium", disabled ? "text-gray-400" : "text-gray-700")}>사진 업로드</span> */}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChangeFileInput}
          className="hidden"
          disabled={disabled}
        />
      </button>

      {uploadedImage && (
        <button
          onClick={handleRemoveClick}
          className={cn(
            "absolute top-8 right-8 inline-flex aspect-square items-center rounded-full bg-[rgba(255,255,255,0.70)] p-2 text-gray-500 cursor-pointer",
            disabled ? "text-gray-400 cursor-not-allowed" : "hover:text-gray-600"
          )}
          type="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRemoveClick(e);
            }
          }}
          aria-label="이미지 삭제"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export const EmojiUploadButton = ({ disabled = false, className }: ImageUploadButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const dialogId = useId();

  const handleClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setIsOpen(false);
  };

  const handleRemove = () => {
    setSelectedEmoji(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "relative w-20 h-20 rounded-full border-2 border-dashed border-gray-400 bg-gray-800 outline-none disabled:opacity-40 flex items-center justify-center group",
          !disabled && "hover:border-gray-300 hover:bg-gray-700",
          className
        )}
        aria-label={selectedEmoji ? `이모지 업로드 버튼 (선택된 이모지: ${selectedEmoji})` : "이모지 업로드 버튼"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <div className="absolute -top-2 -left-2 w-4 h-4 border-2 border-dashed border-gray-400 bg-gray-800 transform rotate-45 rounded-sm" />

        {selectedEmoji ? (
          <div className="text-2xl">{selectedEmoji}</div>
        ) : (
          <div className="text-gray-300 text-2xl group-hover:text-gray-200 transition-colors">😊</div>
        )}
      </button>

      {selectedEmoji && (
        <button
          onClick={e => {
            e.stopPropagation();
            handleRemove();
          }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors cursor-pointer"
          type="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              handleRemove();
            }
          }}
          aria-label="이모지 삭제"
        >
          <X size={12} />
        </button>
      )}

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50"
          role="dialog"
          aria-labelledby={dialogId}
          aria-modal="true"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 id={dialogId} className="text-sm font-medium text-gray-700">
              이모지 선택
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              type="button"
              aria-label="이모지 선택 창 닫기"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-10 gap-2 max-h-48 overflow-y-auto">
            {EMOJI_LIST.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                type="button"
                aria-label={`이모지 ${emoji} 선택`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const BackButton = ({ isZoomed, globeRef, onReset }: BackButtonProps) => {
  const handleBackClick = () => {
    if (globeRef.current?.globeRef?.current) {
      // 스택/클러스터링 상태를 먼저 초기화하여 줌아웃 애니메이션 중 스냅 트리거 방지
      globeRef.current.resetGlobe?.();
      // 카메라 줌아웃 애니메이션
      globeRef.current.globeRef.current.pointOfView({ altitude: ZOOM_LEVELS.DEFAULT }, 1000);
      // 애니메이션 완료 후 페이지 UI 상태 초기화
      setTimeout(onReset, 1000);
    } else {
      onReset();
    }
  };

  return (
    <div
      className={`absolute bottom-4 right-4 transition-opacity duration-500 z-50 ${isZoomed ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <button
        type="button"
        onClick={handleBackClick}
        className="flex items-center gap-2 bg-surface-placeholder--16 backdrop-blur-sm text-text-primary px-4 py-3 rounded-full font-medium text-sm hover:bg-surface-placeholder--8 transition-all duration-200 cursor-pointer"
      >
        돌아가기
        <ReturnIcon width={20} height={20} aria-hidden="true" />
      </button>
    </div>
  );
};
