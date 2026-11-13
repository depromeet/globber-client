/** 로그인 화면으로 보내며 실패 이유를 알릴 때 쓰는 쿼리 이름 (GLB-387) */
export const LOGIN_ERROR_PARAM = "error";

export const LOGIN_ERROR_MESSAGES = {
  // 카카오 동의 취소 등 OAuth 로그인이 실패했을 때
  oauth_failed: "로그인하지 못했어요. 다시 시도해 주세요.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

/** 쿼리 값이 알려진 실패 코드일 때만 안내 문구를 돌려준다. 임의 문자열은 화면에 그대로 보여 주지 않는다 */
export const getLoginErrorMessage = (code: string | null | undefined): string | null =>
  code && Object.hasOwn(LOGIN_ERROR_MESSAGES, code) ? LOGIN_ERROR_MESSAGES[code as LoginErrorCode] : null;
