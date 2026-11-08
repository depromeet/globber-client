import { useEffect, useRef, useState } from "react";

type UseOwnerToastOptions = {
  duration?: number;
};

type UseOwnerToastResult = {
  showToast: boolean;
  toastMessage: string;
  setShowToast: (open: boolean) => void;
  showOwnerToast: (message: string) => void;
};

/**
 * owner 전용 토스트 노출
 *
 * @param options 옵션 객체
 * @param options.duration 토스트 떠있는 시간, default: 1500
 * @returns 토스트 상태, `showOwnerToast` 핸들러
 */
export const useOwnerToast = (options: UseOwnerToastOptions = {}): UseOwnerToastResult => {
  const { duration = 1500 } = options;
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const lastToastTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showOwnerToast = (message: string) => {
    const now = Date.now();
    const timeSinceLastToast = now - lastToastTimeRef.current;

    // duration 이내 연속 호출: Toast 재노출 X (중복 방지)
    if (timeSinceLastToast < duration) {
      return;
    }

    // duration 이후 재호출: Toast 재노출
    lastToastTimeRef.current = now;
    setToastMessage(message);
    setShowToast(true);

    // 기존 타이머 정리
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    // duration 후 Toast 자동 닫기
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    showToast,
    toastMessage,
    setShowToast,
    showOwnerToast,
  };
};
