"use client";

import { type CSSProperties, useEffect, useState } from "react";

import { HeadlessToast, HeadlessToastProvider } from "@/components/common/Toast";
import { cn } from "@/utils/cn";

const DEFAULT_TOAST_DURATION = 1500;

type ToastType = "success" | "error";

/**
 * 토스트 모양. 화면마다 디자인이 달라 모양만 고르고, 띄우는 방식은 전역 토스트 하나로 모은다 (GLB-352)
 * - default: 전역 기본(반투명·블러, 하단 18)
 * - solid: 다른 사람 지구본 리스트 보기의 저장 결과(진한 배경, 하단 72px)
 * - solidRaised: 다른 사람 지구본 지구본 보기의 저장 결과(진한 배경, 하단 118px. 버튼 줄 위로 띄움)
 * - editor: 기록 작성 화면(반투명·테두리, 하단 6)
 * - reaction: 기록 상세 이모지 안내(블러, 하단 40)
 */
export type ToastVariant = "default" | "solid" | "solidRaised" | "editor" | "reaction";

type ToastOptions = {
  variant?: ToastVariant;
  /** 자동 닫힘 시간(ms). 기본 1.5초 */
  duration?: number;
};

type ToastState = {
  id: number;
  message: string;
  type: ToastType;
  variant: ToastVariant;
  duration: number;
};

type CurrentToast = ToastState & {
  /** false가 되면 Radix가 닫힘 애니메이션을 마친 뒤 토스트를 내린다 */
  open: boolean;
};

type VariantStyle = {
  viewportClassName: string;
  className: (type: ToastType) => string;
  contentClassName: (type: ToastType) => string;
  style?: CSSProperties;
};

const SOLID_TOAST_CLASS_NAME = "toast-anim w-full pl-3 pr-8 py-3 rounded-xl bg-[#21272d] flex items-center gap-2";
const SOLID_TOAST_CONTENT_CLASS_NAME = "text-sm font-semibold text-white tracking-[-0.28px] leading-[1.3] text-center";

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  default: {
    viewportClassName:
      "fixed bottom-[calc(72px+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-4 w-full max-w-96",
    className: () =>
      "toast-anim w-full min-h-12 px-4 py-3.5 rounded-lg outline-1 outline-offset-[-1px] backdrop-blur-[5.15px] flex items-center gap-4 bg-[rgba(255,255,255,0.1)] outline-[rgba(255,255,255,0.05)]",
    contentClassName: type =>
      cn("text-sm font-medium leading-5", type === "success" ? "text-text-primary" : "text-white"),
  },
  solid: {
    viewportClassName:
      "fixed bottom-[calc(72px+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-92.5",
    className: () => SOLID_TOAST_CLASS_NAME,
    contentClassName: () => SOLID_TOAST_CONTENT_CLASS_NAME,
  },
  solidRaised: {
    viewportClassName:
      "fixed bottom-[calc(118px+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-92.5",
    className: () => SOLID_TOAST_CLASS_NAME,
    contentClassName: () => SOLID_TOAST_CONTENT_CLASS_NAME,
  },
  reaction: {
    viewportClassName:
      "fixed bottom-[calc(160px+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-92.5 max-w-[calc(100%-32px)]",
    className: () => "backdrop-blur-[25px] backdrop-filter flex items-center gap-4 px-4 py-3.5 rounded-lg",
    contentClassName: () => "text-sm font-medium text-white text-center text-nowrap",
  },
  editor: {
    viewportClassName:
      "fixed bottom-[calc(24px+var(--safe-area-bottom))] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-32px)] max-w-92.5",
    className: () => "flex items-center w-full h-12 rounded-lg border text-white px-4",
    contentClassName: () => "font-medium text-sm leading-none flex items-center",
    style: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderColor: "rgba(255, 255, 255, 0.04)",
      paddingTop: "14px",
      paddingBottom: "14px",
    },
  },
};

const listeners = new Set<(toast: ToastState) => void>();
let nextId = 0;

const show = (message: string, type: ToastType, options: ToastOptions = {}) => {
  nextId += 1;
  const next: ToastState = {
    id: nextId,
    message,
    type,
    variant: options.variant ?? "default",
    duration: options.duration ?? DEFAULT_TOAST_DURATION,
  };
  listeners.forEach(listener => listener(next));
};

/** 어느 컴포넌트·훅에서든 호출하는 전역 토스트 */
export const toast = {
  success: (message: string, options?: ToastOptions) => show(message, "success", options),
  error: (message: string, options?: ToastOptions) => show(message, "error", options),
};

/** ClientLayout에 한 번만 마운트함 */
export const GlobalToaster = () => {
  const [current, setCurrent] = useState<CurrentToast | null>(null);

  useEffect(() => {
    const listener = (next: ToastState) => setCurrent({ ...next, open: true });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const variantStyle = VARIANT_STYLES[current?.variant ?? "default"];

  return (
    <HeadlessToastProvider viewportClassName={variantStyle.viewportClassName}>
      {current && (
        <HeadlessToast
          key={current.id}
          open={current.open}
          onOpenChange={open => {
            if (open) return;
            // 새 토스트로 바뀐 뒤 이전 토스트의 닫힘 타이머가 와도 새 토스트를 닫지 않도록 id를 확인한다
            const closedId = current.id;
            setCurrent(active => (active?.id === closedId ? { ...active, open: false } : active));
          }}
          duration={current.duration}
          className={variantStyle.className(current.type)}
          style={variantStyle.style}
          contentClassName={variantStyle.contentClassName(current.type)}
        >
          {current.message}
        </HeadlessToast>
      )}
    </HeadlessToastProvider>
  );
};
