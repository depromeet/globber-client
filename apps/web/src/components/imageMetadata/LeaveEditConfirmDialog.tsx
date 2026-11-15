"use client";

import { Button } from "@/components/common/Button";
import { Dialog, DialogActions, DialogContent, DialogHeader, DialogTitle } from "@/components/common/Dialog";
import { cn } from "@/utils/cn";

type LeaveEditConfirmDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
};

/**
 * 기록 작성·편집 중 뒤로가기를 누르면 입력이 사라진다는 것을 알리고 나갈지 묻는 확인 창 (GLB-134).
 * 회원탈퇴·로그아웃 확인 창과 같은 크기·색을 쓴다.
 */
export const LeaveEditConfirmDialog = ({ isOpen, onOpenChange, onLeave }: LeaveEditConfirmDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-75! max-w-75! bg-gray-750 border-0 rounded-2xl p-0 gap-0",
          "shadow-[0px_2px_20px_0px_rgba(0,0,0,0.25)]"
        )}
        ariaDescription="작성 중인 기록에서 나가기 확인"
      >
        <DialogHeader className="flex flex-col gap-1 items-center justify-center text-center py-7.5 px-5 rounded-t-2xl border-0">
          <DialogTitle className="text-[18px]! font-bold! text-white! leading-[1.3]!">
            작성 중인 내용이 사라져요
          </DialogTitle>
          <p className="text-[13px] font-medium text-white">지금 나가면 사진과 글이 저장되지 않아요.</p>
        </DialogHeader>

        <DialogActions className="flex gap-2.5 px-5 pb-5 rounded-b-2xl border-0 w-full items-center">
          <Button
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex flex-1 rounded-2xl h-[45px] px-5 py-3 justify-center items-center",
              "bg-surface-placeholder--8",
              "text-white text-[14px] font-bold",
              "hover:bg-surface-placeholder--16 transition-colors"
            )}
          >
            계속 작성
          </Button>
          <Button
            onClick={onLeave}
            className={cn(
              "flex flex-1 rounded-2xl h-[45px] px-5 py-3 justify-center items-center",
              "bg-state-warning!",
              "text-white text-[14px] font-bold",
              "hover:bg-[#ff5a3a]! transition-colors"
            )}
          >
            나가기
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
