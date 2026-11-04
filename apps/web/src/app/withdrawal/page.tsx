"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";

import { Header } from "@/components/common/Header";
import { WithdrawalDialog } from "@/components/profile/WithdrawalDialog";
import { useWithdrawMemberMutation } from "@/hooks/mutation/useProfileMutations";
import { clearAllCookies } from "@/utils/cookies";

export default function WithdrawalPage() {
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
      clearAllCookies();

      setIsDialogOpen(false);
      router.push("/");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "회원탈퇴에 실패했습니다. 다시 시도해주세요.";
      alert(errorMessage);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
        <div className="max-w-lg mx-auto w-full">
          <Header variant="navy" leftIcon="back" onLeftClick={() => router.back()} title="회원탈퇴" />
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 py-5 flex flex-col gap-6">
            {/* Withdrawal Notice */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-4">회원탈퇴 안내</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                회원탈퇴를 원하실 경우, 앱 내 [회원탈퇴] 버튼을 통해 즉시 탈퇴하실 수 있습니다.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-4">탈퇴 시 다음과 같은 사항이 처리됩니다.</p>
              <ul className="text-sm text-text-secondary leading-relaxed mt-3 list-disc list-inside space-y-2">
                <li>카카오 계정 연동이 해제됩니다.</li>
                <li>글로버 내 저장된 모든 여행 기록, 사진, 리액션이 즉시 삭제됩니다.</li>
                <li>프로필 정보 및 사용자 데이터가 즉시 삭제됩니다.</li>
              </ul>
            </section>

            {/* Additional Notice */}
            <section>
              <h2 className="text-lg font-bold text-text-primary mb-4">유의사항</h2>
              <ul className="text-sm text-text-secondary leading-relaxed space-y-3 list-disc list-inside">
                <li>탈퇴 후 같은 카카오 계정으로 재가입할 수 있습니다.</li>
                <li>탈퇴 전에 작성한 모든 여행 기록, 사진, 친구 관계 등이 완전히 삭제됩니다. 복구는 불가능합니다.</li>
              </ul>
            </section>
          </div>
        </div>

        {/* Withdrawal Button - Fixed at Bottom */}
        <div className="max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            disabled={withdrawMemberMutation.isPending}
            className="w-full px-4 pt-4 pb-[30px] flex justify-center items-center gap-2 cursor-pointer"
          >
            <p className="text-sm font-semibold underline text-[rgba(255,255,255,0.60)]">
              {withdrawMemberMutation.isPending ? "탈퇴 중..." : "회원탈퇴"}
            </p>
          </button>
        </div>
      </div>

      <WithdrawalDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleWithdrawal}
        isLoading={withdrawMemberMutation.isPending}
      />
    </main>
  );
}
