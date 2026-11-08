// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5bff713fb9f69a082779662535db3ab6@o4511100216672256.ingest.us.sentry.io/4511100297281536",

  // 로컬 개발(next dev) 에러가 운영 알림(Discord)으로 전송되지 않도록 production 빌드에서만 활성화
  enabled: process.env.NODE_ENV === "production",

  // 개발 서버 이벤트가 운영(production)과 섞이지 않도록 배포 환경 이름을 지정한다 (next.config.ts의 NEXT_PUBLIC_DEPLOYMENT_ENV)
  environment: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
