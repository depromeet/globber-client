import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import ReturnIcon from "@/assets/icons/return.svg";
import { ZOOM_LEVELS } from "@/constants/clusteringConstants";
import type { BackButtonProps } from "@/types/button";
import { cn } from "@/utils/cn";

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
      // 줌인 상태가 아닐 때 숨겨진 버튼에 Tab 포커스가 가지 않도록 한다
      inert={!isZoomed}
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
