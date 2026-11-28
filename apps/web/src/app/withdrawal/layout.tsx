import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원 탈퇴 - Globber",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
