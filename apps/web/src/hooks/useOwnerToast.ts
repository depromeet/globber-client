import { useRef } from "react";

import { toast } from "@/components/common/GlobalToast";

type UseOwnerToastOptions = {
  duration?: number;
};

/**
 * 기록 주인이 자기 기록의 이모지를 누를 때 보여 주는 안내 토스트 (전역 토스트의 reaction 모양, GLB-352)
 *
 * @param options 옵션 객체
 * @param options.duration 토스트 떠있는 시간, default: 1500
 * @returns `showOwnerToast` 핸들러. duration 안에 다시 부르면 무시한다
 */
export const useOwnerToast = (options: UseOwnerToastOptions = {}) => {
  const { duration = 1500 } = options;
  const lastToastTimeRef = useRef<number>(0);

  const showOwnerToast = (message: string) => {
    const now = Date.now();
    // duration 이내 연속 호출은 다시 띄우지 않는다(중복 방지)
    if (now - lastToastTimeRef.current < duration) return;
    lastToastTimeRef.current = now;
    toast.success(message, { variant: "reaction", duration });
  };

  return { showOwnerToast };
};
