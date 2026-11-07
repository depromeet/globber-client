export const env = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://globber.world/api",
  // API 기본값(운영)과 같은 환경의 버킷을 쓰도록 운영 버킷을 기본값으로 둔다
  S3_BASE_URL: process.env.NEXT_PUBLIC_S3_BASE_URL || "https://globber-prod.s3.ap-northeast-2.amazonaws.com/",
  REDIRECT_ORIGIN: process.env.NEXT_PUBLIC_REDIRECT_ORIGIN,
  COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || ".globber.world",
  IS_LOCAL_DEV: process.env.NODE_ENV === "development",
} as const;
