import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오류 안내 - Globber",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
