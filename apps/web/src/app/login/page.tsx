import Image from "next/image";
import Link from "next/link";

import KakaoLoginButton from "@/components/login/KakaoLoginButton";

const LoginPage = () => {
  return (
    <main className="min-h-dvh w-full mx-auto flex flex-col items-center justify-center relative overflow-hidden">
      {/* 로고 - 전체 높이의 정중앙 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(402px,100vw)] px-6">
        <Image src="/icons/login-logo.webp" alt="로그인 로고" width={402} height={400} className="w-full h-auto" />
      </div>

      {/* 카카오 로그인 버튼과 약관 안내 - 하단 고정 */}
      <div className="absolute bottom-0 w-full max-w-sm px-8 pb-8 flex flex-col items-center gap-3">
        <KakaoLoginButton />
        {/* 가입 전에도 약관·개인정보 처리방침을 확인할 수 있게 한다 (GLB-130) */}
        <p className="text-xs leading-5 text-center text-text-secondary">
          시작하면{" "}
          <Link href="/terms" className="font-medium text-white underline underline-offset-2">
            이용약관 및 개인정보 처리방침
          </Link>
          에 동의하는 것으로 간주돼요.
        </p>
      </div>
    </main>
  );
};

export default LoginPage;
