import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "저장된 지구본 - Globber",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
