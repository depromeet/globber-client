"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { markInAppNavigation } from "@/utils/navigation";

/**
 * 처음 들어온 화면에서 다른 화면으로 이동하면 앱 안 이동이 있었다고 기록함 (GLB-239)
 * 뒤로가기 버튼이 이 기록으로 이전 화면이 앱 안에 있는지 판단함
 */
export const InAppNavigationTracker = () => {
  const pathname = usePathname();
  const entryPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== entryPathnameRef.current) markInAppNavigation();
  }, [pathname]);

  return null;
};
