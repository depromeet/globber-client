import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

// 개발 서버(Vercel)에서만 설정하는 백엔드 주소. 운영은 GCP 리버스 프록시가 /api를 처리하므로 비워 둔다
const devApiOrigin = process.env.DEV_API_ORIGIN;

// 배포 환경 이름. 개발 서버(Vercel) 배포에만 백엔드 주소 DEV_API_ORIGIN이 있으므로 이것으로 구분한다
const deploymentEnv = devApiOrigin ? "development" : "production";

// public 정적 파일 캐시 (기본값은 max-age=0이라 매번 재검증). 내용을 바꿀 때는 파일명을 바꾼다
const STATIC_FILE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

// 모든 응답에 붙이는 보안 헤더 (GLB-341)
// HSTS는 운영 앞단 nginx가 이미 붙이므로(GLB-222) 중복되지 않게 여기서는 넣지 않음
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // 응답에 x-powered-by: Next.js를 붙여 프레임워크 정보를 드러내지 않게 함 (GLB-341)
  poweredByHeader: false,
  // 빌드 시점에 값을 넣어 클라이언트·서버·edge 코드가 같은 환경 이름을 쓴다 (Sentry environment, robots)
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ENV: deploymentEnv,
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
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

    // 백엔드 경로는 모두 /api/v1/...이다 (GLB-298·380). Next.js 자체 API(/api/places 등)는 /api/v1 아래가 아니라 겹치지 않는다
    return [
      { source: "/api/v1/:path*", destination: `${devApiOrigin}/api/v1/:path*` },
      // 카카오 콘솔에 등록된 백엔드 콜백 주소는 경로가 그대로다
      { source: "/login/oauth2/code/:path*", destination: `${devApiOrigin}/login/oauth2/code/:path*` },
      // Swagger는 백엔드 루트 경로에 있고, UI가 문서 JSON을 루트 /v3/api-docs로 요청하므로 함께 넘긴다
      { source: "/api/swagger-ui/:path*", destination: `${devApiOrigin}/swagger-ui/:path*` },
      { source: "/v3/api-docs/:path*", destination: `${devApiOrigin}/v3/api-docs/:path*` },
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

// 환경 변수가 빠졌을 때 config/env.ts의 기본값이 조용히 쓰이지 않도록 dev 서버 시작·빌드 시점에 경고함 (GLB-282, GLB-319)
// 기본값과 운영 빌드 동작은 그대로 두고 알리기만 함
if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn(
    "[env] NEXT_PUBLIC_API_BASE_URL이 없어 운영 API(https://globber.world)로 요청합니다. 로컬 개발이면 .env.local에 개발 API 주소를 넣어 주세요."
  );
}
if (!process.env.NEXT_PUBLIC_S3_BASE_URL) {
  console.warn(
    "[env] NEXT_PUBLIC_S3_BASE_URL이 없어 개발용 S3 버킷 주소를 기본값으로 씁니다. 운영 빌드라면 사진과 썸네일이 깨질 수 있습니다."
  );
}

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
