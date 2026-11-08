import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { randomBytes } from "node:crypto";

import { getOAuthOrigin, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS } from "@/app/login/oauth/state";
import { env } from "@/config/env";

export async function GET(request: NextRequest) {
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS);

  // 백엔드 인가 요청의 state와 별개로, 일회용 code가 이 브라우저에서 시작한 로그인인지 묶는다.
  const callback = new URL("/login/oauth/success", getOAuthOrigin(request));
  callback.searchParams.set("state", state);
  const authorization = new URL(`${env.API_BASE_URL}/oauth2/authorization/kakao`);
  authorization.searchParams.set("redirect_uri", callback.toString());
  const response = NextResponse.redirect(authorization);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
