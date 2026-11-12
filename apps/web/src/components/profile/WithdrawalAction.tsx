"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";

import { toast } from "@/components/common/GlobalToast";
import { WithdrawalDialog } from "@/components/profile/WithdrawalDialog";
import { useWithdrawMemberMutation } from "@/hooks/mutation/useProfileMutations";
import { clearAuthCookies } from "@/utils/cookies";

/**
 * 회원탈퇴 페이지의 하단 탈퇴 버튼과 확인 다이얼로그.
 * 탈퇴 안내 문구는 정적이라 페이지(서버 컴포넌트)에 두고, 상태·요청·GA가 필요한 부분만 클라이언트로 분리한다.
 */
export const WithdrawalAction = () => {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const withdrawMemberMutation = useWithdrawMemberMutation();

  useEffect(() => {
    sendGAEvent("event", "menu_profile_withdraw_view", { flow: "menu", screen: "profile_withdraw" });
  }, []);

  const handleWithdrawal = async () => {
    try {
      // 회원 탈퇴 API 호출
      await withdrawMemberMutation.mutateAsync();

      // 쿠키 정리
      clearAuthCookies();

      setIsDialogOpen(false);
      router.push("/");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "회원탈퇴에 실패했습니다. 다시 시도해주세요.";
      toast.error(errorMessage);
    }
  };

  return (
    <>
      {/* 탈퇴 버튼 - 하단 고정 */}
      <div className="max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          disabled={withdrawMemberMutation.isPending}
          className="w-full px-4 pt-4 pb-7.5 flex justify-center items-center gap-2 cursor-pointer"
        >
          <p className="text-sm font-semibold underline text-[rgba(255,255,255,0.60)]">
            {withdrawMemberMutation.isPending ? "탈퇴 중..." : "회원탈퇴"}
          </p>
        </button>
      </div>

      <WithdrawalDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleWithdrawal}
        isLoading={withdrawMemberMutation.isPending}
      />
    </>
  );
};
