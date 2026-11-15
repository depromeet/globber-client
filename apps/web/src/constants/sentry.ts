/**
 * Sentry 설정 상수
 *
 * 운영 DSN을 기본값으로 두고, 개발 배포(Vercel globber-client-dev)에서만 NEXT_PUBLIC_SENTRY_DSN으로
 * 개발용 Sentry 프로젝트 DSN을 넣어 개발 서버 오류가 운영 프로젝트에 쌓이지 않게 한다 (GLB-123).
 * DSN은 브라우저 번들에 그대로 들어가는 공개 값이라 비밀값이 아니다.
 */
const PRODUCTION_SENTRY_DSN =
  "https://5bff713fb9f69a082779662535db3ab6@o4511100216672256.ingest.us.sentry.io/4511100297281536";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || PRODUCTION_SENTRY_DSN;

/** 개발 서버 오류를 받는 Sentry 프로젝트. 이 프로젝트의 이슈 알림은 Discord 제목 앞에 [개발]을 붙인다 */
export const SENTRY_DEV_PROJECT_SLUG = "globber-frontend-dev";
