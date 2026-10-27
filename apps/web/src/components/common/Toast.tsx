"use client";

import * as React from "react";

import * as ToastPrimitive from "@radix-ui/react-toast";

export type HeadlessToastProviderProps = {
  children: React.ReactNode;
  /** 토스트들이 쌓이는 영역의 className (레이아웃/포지션 제어) */
  viewportClassName?: string;
};

/**
 * Radix Toast Provider + Viewport 래퍼.
 * 스타일은 외부에서 주입하며, 내부 로직/접근성만 제공합니다.
 */
export function HeadlessToastProvider({ children, viewportClassName }: HeadlessToastProviderProps) {
  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastPrimitive.Viewport className={viewportClassName} />
    </ToastPrimitive.Provider>
  );
}

export type HeadlessToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
  /** 이모지 혹은 아이콘 노드 (예: "😥") */
  leading?: React.ReactNode;
  /** 본문 텍스트 노드 (리치 텍스트 가능) */
  children?: React.ReactNode;
  /** 루트에 전달할 className (배경/보더/패딩 등 스타일) */
  className?: string;
  /** 리딩 아이콘 컨테이너에 적용할 className (예: size/색) */
  leadingClassName?: string;
  /** 컨텐츠 텍스트 컨테이너 className */
  contentClassName?: string;
  /** 토스트 열림 제어 (명시적으로 노출) */
  open?: boolean;
  /** 열림 상태 변경 핸들러 (명시적으로 노출) */
  onOpenChange?: (open: boolean) => void;
  /** 초기 열림 상태 */
  defaultOpen?: boolean;
  /** 자동 닫힘 시간(ms) */
  duration?: number;
};

/**
 * Headless Toast 컴포넌트
 * - 시맨틱/접근성은 유지, 시각 스타일은 전부 외부 className으로 주입
 */
export const HeadlessToast = React.forwardRef<HTMLLIElement, HeadlessToastProps>(
  ({ leading, children, className, leadingClassName, contentClassName, open, ...rootProps }, ref) => {
    return (
      <ToastPrimitive.Root ref={ref} className={className} open={open} {...rootProps}>
        {leading ? <div className={leadingClassName}>{leading}</div> : null}
        {children ? <div className={contentClassName}>{children}</div> : null}
        <ToastPrimitive.Close aria-label="Close" asChild>
          <button type="button" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  }
);
HeadlessToast.displayName = "HeadlessToast";

// 외부에서 컨트롤 할 수 있도록 Radix 프리미티브 재노출
export const ToastClose = ToastPrimitive.Close;
export const ToastAction = ToastPrimitive.Action;
export const ToastDescription = ToastPrimitive.Description;
export const ToastTitle = ToastPrimitive.Title;
export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ToastPrimitive.Viewport;
export const ToastRoot = ToastPrimitive.Root;

/**
 * 사용 예 (Figma 스펙 반영)
 *
 * <HeadlessToastProvider viewportClassName="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[370px]">
 *   <HeadlessToast
 *     open={open}
 *     onOpenChange={setOpen}
 *     className="grid grid-cols-[24px_1fr] items-center gap-2 rounded-xl bg-[#21272D] text-white px-3 py-3"
 *     leadingClassName="w-6 h-6 flex items-center justify-center"
 *     contentClassName="font-semibold text-sm tracking-[-0.02em]"
 *     leading={<span className="text-[20px]">😥</span>}
 *   >
 *     기능을 준비하고 있어요. 런칭데이에 만나요!
 *   </HeadlessToast>
 * </HeadlessToastProvider>
 */
