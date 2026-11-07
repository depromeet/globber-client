import type { Metadata, Viewport } from "next";

import { GoogleAnalytics } from "@next/third-parties/google";

import { ClientLayout } from "@/components/common/ClientLayout";

import "./globals.css";

export const metadata: Metadata = {
  title: "Globber(글로버) - 지구본 위에서, 나의 여행을 한눈에!",
  description: "지구본으로 완성하는 여행 기록 서비스",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "96x96", type: "image/png" },
    ],
  },
  verification: {
    google: "MdK2I7MZCVFYo8ETh4nNJGQY4V2rug-_9fkgw-G4H94",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        {/* 전체 글리프(2MB) 대신 화면에 쓰인 글자 범위의 조각 파일만 받는다 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className="antialiased min-h-dvh"
        style={{ background: "linear-gradient(180deg, #001D39 0%, #0D0C14 100%)" }}
      >
        <ClientLayout>
          <div className="w-full min-h-dvh">{children}</div>
        </ClientLayout>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
