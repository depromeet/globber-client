export const env = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://globber.world/api",
  REDIRECT_ORIGIN: process.env.NEXT_PUBLIC_REDIRECT_ORIGIN,
  // 없으면 domain을 지정하지 않아 현재 호스트 전용 쿠키가 된다 (운영은 deploy.yml에서 .globber.world 주입)
  COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
  IS_LOCAL_DEV: process.env.NODE_ENV === "development",
} as const;
