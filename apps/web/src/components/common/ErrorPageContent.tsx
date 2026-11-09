"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import type { ErrorType } from "@globber/shared/types/error";

import Error401Icon from "@/assets/icons/401_error.png";
import Error404Icon from "@/assets/icons/404_erorr.png";
import Error500Icon from "@/assets/icons/500_error.png";
import { Button } from "@/components/common/Button";
import { clearAllCookies } from "@/utils/cookies";

type ErrorPageContentProps = {
  errorType: ErrorType;
  /** 오류가 난 화면 주소. 있으면 500 화면의 첫 버튼이 "다시 시도"가 되어 그 화면을 다시 연다 (GLB-135) */
  retryPath?: string | null;
  /** 같은 자리에서 다시 시도하는 함수(라우트 오류 경계의 reset 등). retryPath보다 우선한다 */
  onRetry?: () => void;
};

export const ErrorPageContent = ({ errorType, retryPath, onRetry }: ErrorPageContentProps) => {
  const router = useRouter();

  const handleLogin = () => {
    clearAllCookies();
    router.push("/login");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const canRetry = Boolean(onRetry || retryPath);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    // 서버 컴포넌트 데이터까지 새로 받도록 클라이언트 이동 대신 전체 페이지로 다시 연다
    if (retryPath) window.location.assign(retryPath);
  };

  const handleGoBack = () => {
    // 이전 페이지로 이동 (history가 있으면 back, 없으면 홈으로)
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const getErrorContent = () => {
    switch (errorType) {
      case "401":
        return {
          icon: Error401Icon,
          title: "로그인이 만료됐어요.",
          description: (
            <>
              세션이 만료되었거나 접근 권한이 없습니다.
              <br />
              다시 로그인 해주세요.
            </>
          ),
          buttons: (
            <Button variant="primary" size="lg" onClick={handleLogin} className="w-full">
              로그인 하러 가기
            </Button>
          ),
        };
      case "404":
        return {
          icon: Error404Icon,
          title: "페이지를 찾을 수 없어요.",
          description: (
            <>
              주소가 올바르지 않거나,
              <br />
              존재하지 않는 페이지입니다.
            </>
          ),
          buttons: (
            <Button variant="primary" size="lg" onClick={handleGoHome} className="w-full">
              홈으로 가기
            </Button>
          ),
        };
      case "500":
      default:
        return {
          icon: Error500Icon,
          title: "일시적인 오류가 발생했어요.",
          description: (
            <>
              요청 처리 중 문제가 발생했습니다.
              <br />
              잠시 후 다시 시도해주세요.
            </>
          ),
          buttons: (
            <div className="w-full flex flex-col gap-2">
              {/* 다시 시도할 방법이 있으면 그 화면을 다시 열고, 없으면 문구를 동작에 맞춰 이전 화면으로 보낸다 */}
              <Button variant="primary" size="lg" onClick={canRetry ? handleRetry : handleGoBack} className="w-full">
                {canRetry ? "다시 시도" : "이전 화면으로"}
              </Button>
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full h-14 px-12 py-4 rounded-2xl inline-flex justify-center items-center gap-2.5 text-[var(--color-text-primary)] text-lg font-bold hover:bg-[var(--color-surface-placeholder--8)] transition-colors"
              >
                홈으로 이동
              </button>
            </div>
          ),
        };
    }
  };

  const content = getErrorContent();

  return (
    <div className="min-h-dvh w-full flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-10">
        <div className="w-48 h-48 relative">
          <Image src={content.icon} alt={`${errorType} 에러 아이콘`} fill className="object-contain" />
        </div>
        <div className="w-full flex flex-col items-center gap-5">
          <h1 className="w-full text-center text-[var(--color-text-primary)] text-3xl font-bold leading-9">
            {content.title}
          </h1>
          <p className="w-full text-center text-[var(--color-text-secondary)] text-lg font-medium leading-7">
            {content.description}
          </p>
        </div>
        <div className="w-full px-4 pt-4 pb-7 flex flex-col gap-2">{content.buttons}</div>
      </div>
    </div>
  );
};
