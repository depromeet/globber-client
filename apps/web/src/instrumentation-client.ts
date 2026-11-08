// 이 파일은 클라이언트에서 Sentry 초기화를 설정한다.
// 여기에 추가한 설정은 사용자가 브라우저에서 페이지를 불러올 때마다 적용된다.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { env } from "@/config/env";

Sentry.init({
  dsn: "https://5bff713fb9f69a082779662535db3ab6@o4511100216672256.ingest.us.sentry.io/4511100297281536",

  // 로컬 개발(next dev) 에러가 운영 알림(Discord)으로 전송되지 않도록 production 빌드에서만 활성화
  enabled: env.IS_PRODUCTION,

  // 개발 서버 이벤트가 운영(production)과 섞이지 않도록 배포 환경 이름을 지정한다 (next.config.ts의 NEXT_PUBLIC_DEPLOYMENT_ENV)
  environment: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,

  // 추가 기능을 위한 선택적 integrations
  integrations: [Sentry.replayIntegration()],

  // 트레이스를 샘플링할 확률을 정의한다. 운영에서는 이 값을 조정하거나, 더 세밀한 제어가 필요하면 tracesSampler를 사용한다.
  tracesSampleRate: 1,
  // Sentry로 로그를 전송하도록 활성화한다
  enableLogs: true,

  // Replay 이벤트를 샘플링할 확률을 정의한다.
  // 샘플링 비율은 10%로 설정한다. 개발 중에는 100%로 두고
  // 운영에서는 더 낮은 비율로 샘플링하는 것을 고려한다.
  replaysSessionSampleRate: 0.1,

  // 에러가 발생했을 때 Replay 이벤트를 샘플링할 확률을 정의한다.
  replaysOnErrorSampleRate: 1.0,

  // 사용자 PII(개인 식별 정보) 전송을 활성화한다
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
