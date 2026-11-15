"use client";

import { useRouter } from "next/navigation";

import { Header } from "@/components/common/Header";
import { goBackOrFallback } from "@/utils/navigation";

type BackHeaderProps = {
  title: string;
  /** 새 탭·링크로 바로 들어와 돌아갈 기록이 없을 때 이동할 경로 */
  fallbackHref?: string;
};

/**
 * 뒤로가기 버튼이 있는 헤더
 * 뒤로가기만 클라이언트에서 필요해 페이지는 서버 컴포넌트로 두고 이 헤더만 클라이언트로 분리함
 */
export const BackHeader = ({ title, fallbackHref = "/" }: BackHeaderProps) => {
  const router = useRouter();

  return (
    <Header variant="navy" leftIcon="back" onLeftClick={() => goBackOrFallback(router, fallbackHref)} title={title} />
  );
};
