"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { markCurrentHistoryEntryInApp, markInAppNavigation } from "@/utils/navigation";

/**
 * 화면 이동이 있으면 앱 안 이동이 있었다고 탭과 현재 history 항목에 기록함 (GLB-239, GLB-259)
 * 뒤로가기 버튼이 이 기록으로 이전 화면이 앱 안에 있는지 판단함
 */
export const InAppNavigationTracker = () => {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname === previousPathnameRef.current) return;

    previousPathnameRef.current = pathname;
    markInAppNavigation();
    // 새로 만들어진 history 항목에 표시해, 직접 진입한 항목과 구분함
    markCurrentHistoryEntryInApp();
  }, [pathname]);

  return null;
};
