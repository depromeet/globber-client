import { cookies } from "next/headers";

import { AUTH_COOKIE } from "@/constants/authCookies";

/**
 * 서버 컴포넌트에서 쿠키에서 인증 토큰을 가져옵니다.
 * @returns 인증 토큰 또는 null
 */
export const getServerAuthToken = async (): Promise<string> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;

  if (!token) throw new Error("인증 토큰이 없습니다.");

  return token;
};

/**
 * 서버 컴포넌트에서 쿠키에서 인증 정보를 가져옵니다.
 * @returns 토큰, memberId, uuid를 포함한 인증 정보
 */
export const getServerAuthInfo = async () => {
  const cookieStore = await cookies();
  return {
    token: cookieStore.get(AUTH_COOKIE.ACCESS_TOKEN)?.value ?? null,
    memberId: cookieStore.get(AUTH_COOKIE.MEMBER_ID)?.value ?? null,
    uuid: cookieStore.get(AUTH_COOKIE.UUID)?.value ?? null,
  };
};
