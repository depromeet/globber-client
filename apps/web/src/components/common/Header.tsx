"use client";

import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { BackIcon, DotIcon, MenuIcon, PeopleIcon, XIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

export const headerVariants = cva("flex items-center justify-between w-full px-4 pb-3 pt-5 min-h-[60px]", {
  variants: {
    variant: {
      dark: "bg-black",
      transparent: "bg-transparent",
      navy: "bg-surface-secondary",
    },
  },
  defaultVariants: {
    variant: "navy",
  },
});

export type HeaderProps = React.ComponentProps<"header"> &
  VariantProps<typeof headerVariants> & {
    asChild?: boolean;
    leftButton?: React.ReactNode;
    leftIcon?: "back" | "menu" | "close";
    onLeftClick?: () => void;
    title?: string;
    rightButtonTitle?: string;
    rightButtonVariant?: "default" | "white";
    rightIcon?: "dot" | "people" | "close" | React.ReactNode;
    onRightClick?: () => void;
    rightButtonDisabled?: boolean;
  };

export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  (
    {
      className,
      variant,
      asChild = false,
      leftButton,
      leftIcon,
      onLeftClick,
      title,
      rightButtonTitle,
      rightButtonVariant = "default",
      rightIcon,
      onRightClick,
      rightButtonDisabled = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "header";

    const renderLeftIcon = () => {
      if (leftButton) return leftButton;

      const getLeftIcon = () => {
        switch (leftIcon) {
          case "back":
            return <BackIcon width={24} height={24} />;
          case "menu":
            return <MenuIcon width={24} height={24} />;
          case "close":
            return <XIcon width={24} height={24} />;
          default:
            return null;
        }
      };

      const getAriaLabel = () => {
        switch (leftIcon) {
          case "back":
            return "뒤로가기";
          case "menu":
            return "메뉴 열기";
          case "close":
            return "닫기";
          default:
            return "Left action";
        }
      };

      if (leftIcon && onLeftClick) {
        return (
          <button
            type="button"
            onClick={onLeftClick}
            className="flex items-center justify-center w-11 h-11 cursor-pointer hover:opacity-70 transition-opacity"
            aria-label={getAriaLabel()}
          >
            {getLeftIcon()}
          </button>
        );
      }

      return null;
    };

    const renderRightIcon = () => {
      if (!rightIcon) return null;

      // rightIcon이 React Node인 경우 직접 렌더링 (onRightClick 불필요)
      if (typeof rightIcon !== "string") {
        return rightIcon;
      }

      // string 타입인 경우 onRightClick 필요
      if (!onRightClick) return null;

      const getRightIcon = () => {
        switch (rightIcon) {
          case "dot":
            return <DotIcon width={24} height={24} />;
          case "people":
            return <PeopleIcon width={24} height={24} />;
          case "close":
            return <XIcon width={16} height={16} />;
          default:
            return null;
        }
      };

      const getAriaLabel = () => {
        switch (rightIcon) {
          case "dot":
            return "더 보기";
          case "people":
            return "친구 목록";
          case "close":
            return "닫기";
          default:
            return "Right action";
        }
      };

      return (
        <button
          type="button"
          onClick={onRightClick}
          className="flex items-center justify-center w-11 h-11 cursor-pointer hover:opacity-70 transition-opacity"
          aria-label={getAriaLabel()}
        >
          {getRightIcon()}
        </button>
      );
    };

    return (
      <Comp className={cn(headerVariants({ variant }), "relative", className)} ref={ref} {...props}>
        {/* 왼쪽 버튼 영역 */}
        <div className="flex items-center justify-start min-w-0 flex-1">{renderLeftIcon()}</div>

        {/* 가운데 타이틀 영역 - absolute positioning으로 정가운데 고정 */}
        {title && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
            <h1 className="text-lg font-bold text-text-primary truncate">{title}</h1>
          </div>
        )}

        {/* 오른쪽 버튼 영역 */}
        <div className="flex items-center justify-end min-w-0 flex-1 gap-2">
          {/* 오른쪽 아이콘 버튼 */}
          {renderRightIcon()}

          {/* 오른쪽 텍스트 버튼 */}
          {rightButtonTitle && (
            <button
              type="button"
              onClick={onRightClick}
              disabled={rightButtonDisabled}
              className={cn(
                "text-base font-bold",
                rightButtonDisabled
                  ? "text-text-thirdly cursor-not-allowed"
                  : rightButtonVariant === "white"
                    ? "text-white cursor-pointer"
                    : "text-state-focused cursor-pointer"
              )}
              aria-label="Right action"
            >
              {rightButtonTitle}
            </button>
          )}
        </div>
      </Comp>
    );
  }
);

Header.displayName = "Header";
