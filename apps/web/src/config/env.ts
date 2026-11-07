export const env = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://globber.world/api",
  REDIRECT_ORIGIN: process.env.NEXT_PUBLIC_REDIRECT_ORIGIN,
  COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || ".globber.world",
  S3_BASE_URL: process.env.NEXT_PUBLIC_S3_BASE_URL || "https://globber-dev.s3.ap-northeast-2.amazonaws.com/",
  GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_LOCAL_DEV: process.env.NODE_ENV === "development",
} as const;

// 서버 전용 값: NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에는 undefined로 남는다
export const serverEnv = {
  SENTRY_WEBHOOK_SECRET: process.env.SENTRY_WEBHOOK_SECRET,
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  JIRA_WEBHOOK_SECRET: process.env.JIRA_WEBHOOK_SECRET,
  JIRA_DISCORD_WEBHOOK_URL: process.env.JIRA_DISCORD_WEBHOOK_URL,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
} as const;
