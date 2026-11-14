import { expect, it } from "vitest";

import { buildLoginErrorPath, getLoginErrorMessage, LOGIN_ERROR_MESSAGES } from "./loginError";

it("알려진 실패 코드에만 안내 문구를 돌려준다", () => {
  expect(getLoginErrorMessage("oauth_failed")).toBe(LOGIN_ERROR_MESSAGES.oauth_failed);
  expect(getLoginErrorMessage(null)).toBeNull();
  expect(getLoginErrorMessage("")).toBeNull();
  // 임의 값이나 객체 기본 속성 이름은 화면에 쓰지 않는다
  expect(getLoginErrorMessage("<script>")).toBeNull();
  expect(getLoginErrorMessage("toString")).toBeNull();
  expect(getLoginErrorMessage("__proto__")).toBeNull();
});

it("실패 안내용 로그인 경로를 만든다", () => {
  expect(buildLoginErrorPath("oauth_failed")).toBe("/login?error=oauth_failed");
});
