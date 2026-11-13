import { NextResponse } from "next/server";

import { LOGIN_ERROR_PARAM, type LoginErrorCode } from "@/constants/loginError";

// 카카오 동의 취소 등 OAuth 로그인이 실패하면 백엔드(oauthFailureHandler)가 이 주소로 보낸다.
// 경로가 없으면 404에 남으므로, 로그인 화면으로 보내며 실패 안내를 띄운다 (GLB-387)
const OAUTH_FAILED: LoginErrorCode = "oauth_failed";

export async function GET() {
  // 상대 주소로 보내 프록시 뒤에서도 브라우저가 현재 호스트 기준으로 이동하게 한다
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: `/login?${new URLSearchParams({ [LOGIN_ERROR_PARAM]: OAUTH_FAILED })}`,
      "Cache-Control": "no-store",
    },
  });
}
