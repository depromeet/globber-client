"use client";

import { useSearchParams } from "next/navigation";

import { getLoginErrorMessage, LOGIN_ERROR_PARAM } from "@/constants/loginError";

/** 로그인에 실패해 돌아왔을 때 카카오 버튼 위에 이유를 알린다 (GLB-387) */
const LoginErrorMessage = () => {
  const searchParams = useSearchParams();
  const message = getLoginErrorMessage(searchParams.get(LOGIN_ERROR_PARAM));

  if (!message) return null;

  return (
    <p role="alert" className="text-sm leading-5 text-center text-state-warning">
      {message}
    </p>
  );
};

export default LoginErrorMessage;
