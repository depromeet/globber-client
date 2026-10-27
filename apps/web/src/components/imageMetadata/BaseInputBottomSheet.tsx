"use client";

import { useEffect, useRef } from "react";

import { X } from "lucide-react";

import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";

type BaseInputBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  isValid: boolean;
};

export const BaseInputBottomSheet = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  isValid,
}: BaseInputBottomSheetProps) => {
  const historyPushedRef = useRef(false);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isOpen && !historyPushedRef.current) {
      // 바텀시트가 열릴 때 히스토리 엔트리 추가
      window.history.pushState({ bottomSheetOpen: true }, "");
      historyPushedRef.current = true;
      isClosingRef.current = false;
    }

    const handlePopState = () => {
      if (isOpen && historyPushedRef.current && !isClosingRef.current) {
        // 뒤로가기로 바텀시트 닫기
        isClosingRef.current = true;
        historyPushedRef.current = false;
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // 바텀시트가 닫힐 때 히스토리 정리 (닫기 버튼 등으로 닫힌 경우)
      if (!isOpen && historyPushedRef.current && !isClosingRef.current) {
        // 히스토리에 추가한 엔트리가 아직 남아있다면 제거
        // replaceState를 사용하여 현재 상태를 교체 (뒤로가기 이벤트 발생 방지)
        if (window.history.state?.bottomSheetOpen) {
          window.history.replaceState(null, "");
        }
        historyPushedRef.current = false;
      }
      isClosingRef.current = false;
    };
  }, [isOpen, onClose]);

  return (
    <BottomSheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <BottomSheetContent className="max-w-[512px] h-[90dvh] !px-4 flex flex-col overflow-hidden">
        <BottomSheetHeader className="w-full h-11 relative !px-0 shrink-0">
          <BottomSheetTitle className="text-lg font-bold text-white text-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {title}
          </BottomSheetTitle>

          <BottomSheetCloseButton
            onClick={onClose}
            aria-label="닫기"
            className="!absolute !right-0 !left-auto top-1/2 -translate-y-1/2 flex items-center justify-center"
          >
            <X size={24} />
          </BottomSheetCloseButton>
        </BottomSheetHeader>

        {/* Input Area */}
        <div className="flex-1 min-h-0 py-3 overflow-hidden">{children}</div>

        {/* Confirm Button */}
        <div className="pb-8 pt-4 shrink-0">
          <Button
            variant={isValid ? "primary" : "disabled"}
            size="lg"
            onClick={onConfirm}
            disabled={!isValid}
            className="w-full"
          >
            확인
          </Button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
};
