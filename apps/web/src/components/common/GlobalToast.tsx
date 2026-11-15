"use client";

import { useEffect, useState } from "react";

import { HeadlessToast, HeadlessToastProvider } from "@/components/common/Toast";
import { cn } from "@/utils/cn";

const TOAST_DURATION = 1500;

type ToastType = "success" | "error";

type ToastState = {
  id: number;
  message: string;
  type: ToastType;
};

const listeners = new Set<(toast: ToastState) => void>();
let nextId = 0;

const show = (message: string, type: ToastType) => {
  nextId += 1;
  const next = { id: nextId, message, type };
  listeners.forEach(listener => listener(next));
};

/** 어느 컴포넌트·훅에서든 호출하는 전역 토스트 */
export const toast = {
  success: (message: string) => show(message, "success"),
  error: (message: string) => show(message, "error"),
};

/** ClientLayout에 한 번만 마운트함 */
export const GlobalToaster = () => {
  const [current, setCurrent] = useState<ToastState | null>(null);

  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return (
    <HeadlessToastProvider viewportClassName="fixed bottom-18 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-4 w-full max-w-96">
      {current && (
        <HeadlessToast
          key={current.id}
          open
          onOpenChange={open => {
            if (!open) setCurrent(null);
          }}
          duration={TOAST_DURATION}
          className="toast-anim w-full min-h-12 px-4 py-3.5 rounded-lg outline-1 outline-offset-[-1px] backdrop-blur-[5.15px] flex items-center gap-4 bg-[rgba(255,255,255,0.1)] outline-[rgba(255,255,255,0.05)]"
          contentClassName={cn(
            "text-sm font-medium leading-5",
            current.type === "success" ? "text-text-primary" : "text-white"
          )}
        >
          {current.message}
        </HeadlessToast>
      )}
    </HeadlessToastProvider>
  );
};
