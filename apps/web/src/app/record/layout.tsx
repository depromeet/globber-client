import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "여행 기록 - Globber",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
