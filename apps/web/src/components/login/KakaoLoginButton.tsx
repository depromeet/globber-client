"use client";

import { KakaoIcon } from "@/assets/icons";
import { env } from "@/config/env";

const KakaoLoginButton = () => {
  const handleLogin = () => {
    // 카카오 인가 후 돌아올 프론트 콜백 주소
    const redirectUri = `${window.location.origin}/login/oauth/success`;

    const url = `${env.API_BASE_URL}/oauth2/authorization/kakao`;
    const finalUrl = `${url}?redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = finalUrl;
  };

  return (
    <button
      onClick={handleLogin}
      type="button"
      className="group w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-3 text-sm font-medium text-black shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.08)] transition-transform hover:translate-y-[-1px] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
      aria-label="카카오로 로그인"
    >
      <KakaoIcon />
      카카오로 시작하기
    </button>
  );
};

export default KakaoLoginButton;
