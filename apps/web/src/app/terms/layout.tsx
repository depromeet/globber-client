import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "약관 및 정책 - Globber",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
