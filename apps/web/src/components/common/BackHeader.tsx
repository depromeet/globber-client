"use client";

import { useRouter } from "next/navigation";

import { Header } from "@/components/common/Header";

type BackHeaderProps = {
  title: string;
};

/**
 * 뒤로가기 버튼이 있는 헤더.
 * router.back()만 클라이언트에서 필요하므로, 페이지는 서버 컴포넌트로 두고 이 헤더만 클라이언트로 분리한다.
 */
export const BackHeader = ({ title }: BackHeaderProps) => {
  const router = useRouter();

  return <Header variant="navy" leftIcon="back" onLeftClick={() => router.back()} title={title} />;
};
