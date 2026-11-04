// 개발 서버(dev.globber.world)는 운영 쿠키(.globber.world)를 함께 받으므로, 개발 환경에서만 접미사를 붙여 인증 쿠키를 분리한다
const AUTH_COOKIE_SUFFIX = process.env.NEXT_PUBLIC_AUTH_COOKIE_SUFFIX ?? "";

export const AUTH_COOKIE = {
  ACCESS_TOKEN: `kakao_access_token${AUTH_COOKIE_SUFFIX}`,
  MEMBER_ID: `member_id${AUTH_COOKIE_SUFFIX}`,
  UUID: `uuid${AUTH_COOKIE_SUFFIX}`,
} as const;
