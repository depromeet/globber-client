// 공통 컴포넌트 Props 타입 정의

import type { ReactNode } from "react";

// 기본 Props 패턴
export type BaseProps = {
  children?: ReactNode;
  className?: string;
};

// 로딩 관련 Props
export type LoadingProps = {
  duration?: number;
  onComplete?: () => void;
};

// Error Boundary 관련 Props (react-error-boundary 호환)
export type ErrorFallbackProps = {
  error?: Error;
  resetErrorBoundary: () => void;
};

// 검색 관련 Props
export type SearchProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

// 페이지 Props 패턴
export type PageProps<
  TParams = Record<string, string>,
  TSearchParams = Record<string, string | string[] | undefined>,
> = {
  params?: Promise<TParams>;
  searchParams?: Promise<TSearchParams>;
};
