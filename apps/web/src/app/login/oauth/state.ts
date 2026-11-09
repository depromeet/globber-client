import type { NextRequest } from "next/server";

import { env } from "@/config/env";

// __Host- 쿠키는 하위 도메인의 Domain 쿠키가 로그인 nonce를 덮어쓰는 것을 막는다.
export const OAUTH_STATE_COOKIE = env.IS_LOCAL_DEV ? "oauth_login_state" : "__Host-oauth_login_state";
export const OAUTH_STATE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: !env.IS_LOCAL_DEV,
  sameSite: "lax" as const,
  maxAge: 60 * 10,
};

const ALLOWED_HOSTS = ["globber.world", "www.globber.world"];

/** 프록시가 전달한 허용 호스트 또는 설정된 프론트 주소를 사용한다. */
export const getOAuthOrigin = (request: NextRequest): string => {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
  if (forwardedHost && ALLOWED_HOSTS.some(host => forwardedHost === host || forwardedHost.endsWith(`.${host}`))) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return env.REDIRECT_ORIGIN || new URL(request.url).origin;
};
