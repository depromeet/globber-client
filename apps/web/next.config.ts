import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

// 개발 서버(Vercel)에서만 설정하는 백엔드 주소. 운영은 GCP 리버스 프록시가 /api를 처리하므로 비워 둔다
const devApiOrigin = process.env.DEV_API_ORIGIN;

// 배포 환경 이름. 개발 서버(Vercel) 배포에만 백엔드 주소 DEV_API_ORIGIN이 있으므로 이것으로 구분한다
const deploymentEnv = devApiOrigin ? "development" : "production";

// public 정적 파일 캐시 (기본값은 max-age=0이라 매번 재검증). 내용을 바꿀 때는 파일명을 바꾼다
const STATIC_FILE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  output: "standalone",
  // 빌드 시점에 값을 넣어 클라이언트·서버·edge 코드가 같은 환경 이름을 쓴다 (Sentry environment, robots)
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ENV: deploymentEnv,
  },
  async headers() {
    return [
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: STATIC_FILE_CACHE_CONTROL }] },
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: STATIC_FILE_CACHE_CONTROL }] },
      // 개발 서버는 검색 엔진에 색인되지 않도록 모든 응답에 noindex를 붙인다
      ...(deploymentEnv === "development"
        ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
        : []),
    ];
  },
  // 워크스페이스 패키지는 TS 소스를 그대로 노출하므로 Next가 직접 트랜스파일
  transpilePackages: ["@globber/shared", "@globber/tokens"],
  // 모노레포 루트를 기준으로 standalone 트레이싱 (workspace 패키지/루트 node_modules 포함)
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    if (!devApiOrigin) return [];

    // Next.js 자체 API(/api/places 등)와 겹치지 않도록 백엔드 경로만 전달한다
    return [
      { source: "/api/api/:path*", destination: `${devApiOrigin}/api/:path*` },
      // 회원 API(MemberController)는 /api 접두사가 없다. 운영은 GCP 리버스 프록시가 /api를 떼고 넘긴다
      { source: "/api/auth/token", destination: `${devApiOrigin}/auth/token` },
      { source: "/api/logout", destination: `${devApiOrigin}/logout` },
      { source: "/api/withdraw", destination: `${devApiOrigin}/withdraw` },
      { source: "/api/oauth2/:path*", destination: `${devApiOrigin}/oauth2/:path*` },
      { source: "/login/oauth2/code/:path*", destination: `${devApiOrigin}/login/oauth2/code/:path*` },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-toast",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "globber-dev.s3.ap-northeast-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "globber-prod.s3.ap-northeast-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  webpack: config => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    // browserslist/Sentry 대용량 문자열로 인한 webpack 캐시 직렬화 경고 억제 (cosmetic warning)
    config.infrastructureLogging = {
      level: "error",
    };

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: "globber",
  project: "globber-frontend",
  silent: true,

  // SENTRY_AUTH_TOKEN이 설정된 환경(로컬/CI)에서만 소스맵 업로드
  // GCP 빌드 서버에서는 업로드 비활성화하여 빌드 부하 방지
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  tunnelRoute: "/monitoring",
});
