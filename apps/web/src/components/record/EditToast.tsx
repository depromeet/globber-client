"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";

type ToastState = {
  message: string;
  type: ToastType;
} | null;

let toastState: ToastState = null;
const toastListeners: Set<(toast: ToastState) => void> = new Set();
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

const notifyListeners = () => {
  toastListeners.forEach(listener => {
    listener(toastState);
  });
};

export const toast = {
  success: (message: string) => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastState = { message, type: "success" };
    notifyListeners();
    toastTimeout = setTimeout(() => {
      toastState = null;
      notifyListeners();
    }, 1500);
  },
  error: (message: string) => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastState = { message, type: "error" };
    notifyListeners();
    toastTimeout = setTimeout(() => {
      toastState = null;
      notifyListeners();
    }, 1500);
  },
};

export function EditToastContainer() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const listener = (newToast: ToastState) => {
      setToast(newToast);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-4 w-full max-w-[384px]">
      <div
        className={`w-full min-h-12 px-4 py-3.5 rounded-lg outline-1 outline-offset-[-1px] backdrop-blur-[5.15px] inline-flex justify-start items-center gap-4 bg-[rgba(255,255,255,0.1)] outline-[rgba(255,255,255,0.05)]`}
      >
        <div
          className={`text-center justify-start text-sm font-medium leading-5 ${
            toast.type === "success" ? "text-text-primary" : "text-white"
          }`}
        >
          {toast.message}
        </div>
      </div>
    </div>
  );
}
