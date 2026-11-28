import type { Metadata, Viewport } from "next";

import { GoogleAnalytics } from "@next/third-parties/google";

import { ClientLayout } from "@/components/common/ClientLayout";
import { env } from "@/config/env";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE, SITE_NAME, SITE_URL } from "@/constants/site";

import "./globals.css";

export const metadata: Metadata = {
  // 상대 경로로 적은 OG 이미지·URL을 운영 도메인 기준 절대 주소로 바꾸기 위해 둠
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  // 하위 페이지와 공유 지구본 실패 분기가 그대로 물려받는 기본 공유 미리보기 (GLB-243)
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    images: [{ ...OG_IMAGE, alt: SITE_NAME }],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
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
  // iOS가 env(safe-area-inset-*)를 실제 값으로 주도록 화면 끝까지 그린다 (GLB-357)
  // 하단 고정 요소는 globals.css의 --safe-area-bottom 변수로 홈 인디케이터 여백을 둔다
  viewportFit: "cover",
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
        {env.GA_MEASUREMENT_ID && <GoogleAnalytics gaId={env.GA_MEASUREMENT_ID} />}
      </body>
    </html>
  );
}
