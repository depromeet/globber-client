"use client";

import { useCallback } from "react";

import { sendGAEvent } from "@next/third-parties/google";

import { Button } from "@/components/common/Button";
import { Dialog, DialogActions, DialogContent, DialogHeader, DialogTitle } from "@/components/common/Dialog";
import { cn } from "@/utils/cn";

type WithdrawalDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
};

export const WithdrawalDialog = ({ isOpen, onOpenChange, onConfirm, isLoading = false }: WithdrawalDialogProps) => {
  const handleConfirm = useCallback(async () => {
    sendGAEvent("event", "menu_profile_withdraw_confirm_click", {
      flow: "menu",
      screen: "profile_withdraw",
      click_code: "menu.profile.withdraw.confirm",
    });
    try {
      await onConfirm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "회원탈퇴에 실패했습니다. 다시 시도해주세요.";
      alert(errorMessage);
    }
  }, [onConfirm]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[300px]! max-w-[300px]! bg-gray-750 border-0 rounded-2xl p-0 gap-0",
          "shadow-[0px_2px_20px_0px_rgba(0,0,0,0.25)]"
        )}
        ariaDescription="회원탈퇴 확인 모달"
      >
        <DialogHeader className="flex flex-col gap-2.5 items-center justify-center py-[30px] px-5 rounded-t-2xl border-0">
          <div className="flex items-center justify-center size-10 rounded-full">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="size-full"
              role="img"
              aria-label="경고"
            >
              <title>경고 아이콘</title>
              <circle cx="24" cy="24" r="22" fill="currentColor" className="text-[#ff694e]" />
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" className="text-gray-750" />
              <path
                d="M24 16v8M24 28v2"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-gray-750"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1 items-center text-center">
            <DialogTitle className="text-[18px]! font-bold! text-white! leading-[1.3]!">
              정말 탈퇴하시겠어요?
            </DialogTitle>
            <p className="text-[13px] font-medium text-white w-[194px] whitespace-nowrap">
              모든 여행 기록과 데이터가 삭제됩니다.
            </p>
          </div>
        </DialogHeader>

        <DialogActions className="flex gap-2.5 px-5 pb-5 rounded-b-2xl border-0 w-full items-center">
          <Button
            onClick={() => {
              sendGAEvent("event", "menu_profile_withdraw_cancel_click", {
                flow: "menu",
                screen: "profile_withdraw",
                click_code: "menu.profile.withdraw.cancel",
              });
              onOpenChange(false);
            }}
            disabled={isLoading}
            className={cn(
              "flex flex-1 rounded-2xl h-[45px] px-5 py-3 justify-center items-center",
              "bg-surface-placeholder--8",
              "text-white text-[14px] font-bold ",
              "hover:bg-surface-placeholder--16 transition-colors"
            )}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "flex flex-1 rounded-2xl h-[45px] px-5 py-3 justify-center items-center",
              "bg-state-warning!",
              "text-white text-[14px] font-bold ",
              "hover:bg-[#ff5a3a]! transition-colors disabled:opacity-70"
            )}
          >
            {isLoading ? "탈퇴 중..." : "삭제"}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
