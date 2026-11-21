import { describe, expect, it } from "vitest";

import { ApiError, LoginRequiredError } from "@/lib/apiClient";

import { AUTH_MISSING_MESSAGE, getUserErrorMessage, isLoginRequiredError } from "./userErrorMessage";

const FALLBACK = "회원 탈퇴에 실패했습니다. 다시 시도해주세요.";

describe("getUserErrorMessage", () => {
  it("API 오류 원문은 보여 주지 않고 고정 문구를 쓴다", () => {
    const error = new ApiError('HTTP error! status: 400 - {"message":"bad"}', 400, "/api/v1/auth/withdraw");
    expect(getUserErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it("서비스가 감싼 일반 Error와 Error가 아닌 값도 고정 문구를 쓴다", () => {
    expect(getUserErrorMessage(new Error("이모지 누르기에 실패했습니다: HTTP error! status: 500"), FALLBACK)).toBe(
      FALLBACK
    );
    expect(getUserErrorMessage(new TypeError("Failed to fetch"), FALLBACK)).toBe(FALLBACK);
    expect(getUserErrorMessage("oops", FALLBACK)).toBe(FALLBACK);
  });

  it("다시 로그인하라는 안내는 그대로 보여 준다", () => {
    expect(getUserErrorMessage(new Error(AUTH_MISSING_MESSAGE), FALLBACK)).toBe(AUTH_MISSING_MESSAGE);
    expect(getUserErrorMessage(new LoginRequiredError(), FALLBACK)).toBe("로그인이 필요합니다.");
  });
});

describe("isLoginRequiredError", () => {
  it("401 응답, 로그인 필요, 토큰 없음만 로그인 오류로 본다", () => {
    expect(isLoginRequiredError(new ApiError("HTTP error! status: 401", 401, "/x"))).toBe(true);
    expect(isLoginRequiredError(new LoginRequiredError())).toBe(true);
    expect(isLoginRequiredError(new Error(AUTH_MISSING_MESSAGE))).toBe(true);
    expect(isLoginRequiredError(new ApiError("HTTP error! status: 500", 500, "/x"))).toBe(false);
    expect(isLoginRequiredError(new Error("401 아님"))).toBe(false);
  });
});
