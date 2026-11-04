"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProfileData } from "@globber/shared/types/member";
import { buildErrorPagePath } from "@globber/shared/utils/errorType";
import { sendGAEvent } from "@next/third-parties/google";

import { Button } from "@/components/common/Button";
import { Header } from "@/components/common/Header";
import { EditProfileBottomSheet } from "@/components/profile/EditProfileBottomSheet";
import { LogoutDialog } from "@/components/profile/LogoutDialog";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SettingItem } from "@/components/profile/SettingItem";
import { SettingSection } from "@/components/profile/SettingSection";
import { ApiError } from "@/lib/apiClient";
import { logout } from "@/services/authService";
import { uploadAndUpdateProfile } from "@/services/profileService";

type ProfileClientProps = {
  initialProfile: ProfileData | null;
};

export const ProfileClient = ({ initialProfile }: ProfileClientProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(initialProfile);

  useEffect(() => {
    sendGAEvent("event", "menu_profile_view", { flow: "menu", screen: "profile_main" });
  }, []);

  useEffect(() => {
    if (!isEditProfileOpen) return;
    sendGAEvent("event", "menu_profile_edit_view", { flow: "menu", screen: "profile_edit" });
  }, [isEditProfileOpen]);

  // 프로필 데이터가 없으면 (토큰 만료 등) 에러 페이지로 리다이렉트
  useEffect(() => {
    if (initialProfile === null) {
      router.replace(buildErrorPagePath("401"));
    }
  }, [initialProfile, router]);

  const handleLogoutConfirm = useCallback(async () => {
    try {
      setIsLoading(true);

      // 서버에 로그아웃 요청 및 클라이언트 쿠키 삭제
      await logout();

      // 다이얼로그 닫기
      setIsLogoutDialogOpen(false);

      // 로그인 페이지로 이동
      router.push("/login");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "로그아웃에 실패했습니다.";

      alert(errorMessage);

      setIsLogoutDialogOpen(false);
      // [TODO]: error fallback 페이지로 이동
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogoutClick = useCallback(() => {
    sendGAEvent("event", "menu_profile_logout_click", {
      flow: "menu",
      screen: "profile_main",
      click_code: "menu.profile.logout",
    });
    setIsLogoutDialogOpen(true);
  }, []);

  const handleEditProfile = useCallback(() => {
    sendGAEvent("event", "menu_profile_edit_click", {
      flow: "menu",
      screen: "profile_main",
      click_code: "menu.profile.edit",
    });
    setIsEditProfileOpen(true);
  }, []);

  const handleSaveProfile = useCallback(
    async (nickname: string, imageFile?: File) => {
      try {
        setIsLoading(true);

        if (!userProfile) {
          setIsLoading(false);
          setIsEditProfileOpen(false);

          alert("프로필 정보를 불러올 수 없습니다.");
          return;
        }

        // 이미지가 있으면 함께 업로드, 없으면 닉네임만 업데이트
        const updatedProfile = await uploadAndUpdateProfile(nickname, userProfile.memberId, imageFile);
        setUserProfile(updatedProfile);
      } catch (error) {
        console.error("프로필 업데이트 실패", error);

        // 401 에러인 경우 에러 페이지로 리다이렉트
        if (error instanceof ApiError && error.status === 401) {
          router.replace(buildErrorPagePath("401"));
          return;
        }

        alert("프로필 업데이트에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setIsLoading(false);
      }
    },
    [userProfile, router]
  );

  const handleTermsClick = useCallback(() => {
    sendGAEvent("event", "menu_profile_terms_click", {
      flow: "menu",
      screen: "profile_main",
      click_code: "menu.profile.terms",
    });
    // TODO: 약관 페이지로 이동
    router.push("/terms");
  }, [router]);

  const handleWithdrawalClick = useCallback(() => {
    sendGAEvent("event", "menu_profile_withdraw_click", {
      flow: "menu",
      screen: "profile_main",
      click_code: "menu.profile.withdraw",
    });
    // TODO: 회원탈퇴 페이지로 이동
    router.push("/withdrawal");
  }, [router]);

  const handleFeedbackClick = useCallback(() => {
    sendGAEvent("event", "menu_profile_feedback_click", {
      flow: "menu",
      screen: "profile_main",
      click_code: "menu.profile.feedback",
    });

    const ua = navigator.userAgent;
    const isMobile =
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

    const subject = encodeURIComponent("[서비스 의견] ");

    if (isMobile) {
      // 모바일: 기기 내장 메일앱 실행
      window.location.href = `mailto:globber.official@gmail.com?subject=${subject}`;
    } else {
      // PC: Gmail 웹 compose 창 열기
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=globber.official@gmail.com&su=${subject}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }, []);

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
        <div className="max-w-lg mx-auto w-full">
          <Header
            variant="navy"
            leftIcon="back"
            onLeftClick={() => {
              sendGAEvent("event", "menu_profile_back_click", {
                flow: "menu",
                screen: "profile_main",
                click_code: "menu.profile.header.back",
              });
              router.back();
            }}
            title="나의 프로필"
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 20,
            }}
          />
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 py-5 flex flex-col gap-5 min-w-0">
            {/* Profile Card Section */}
            <ProfileCard
              name={userProfile?.nickname ?? ""}
              email={userProfile?.email ?? ""}
              profileImage={userProfile?.profileImageUrl ?? undefined}
              onEditClick={handleEditProfile}
            />

            {/* Usage Info Section */}
            <SettingSection title="이용 정보">
              <SettingItem label="약관 및 정책" onClick={handleTermsClick} />
              <SettingItem label="서비스 의견 보내기" onClick={handleFeedbackClick} />
              <SettingItem label="회원 탈퇴하기" onClick={handleWithdrawalClick} />
            </SettingSection>
          </div>
        </div>

        {/* Logout Button */}
        <div className="px-4 py-7.5 w-full shrink-0">
          <Button onClick={handleLogoutClick} disabled={isLoading} variant="gray" size="lg" className="w-full">
            {isLoading ? "로그아웃 중..." : "로그아웃"}
          </Button>
        </div>

        {/* Logout Dialog */}
        <LogoutDialog
          isOpen={isLogoutDialogOpen}
          onOpenChange={setIsLogoutDialogOpen}
          onConfirm={handleLogoutConfirm}
          isLoading={isLoading}
        />

        {/* Edit Profile Bottom Sheet */}
        <EditProfileBottomSheet
          isOpen={isEditProfileOpen}
          onOpenChange={setIsEditProfileOpen}
          initialName={userProfile?.nickname}
          initialImage={userProfile?.profileImageUrl ?? undefined}
          onSave={handleSaveProfile}
        />
      </div>
    </main>
  );
};
