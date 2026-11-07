"use client";

import { useMutation } from "@tanstack/react-query";

import { logout } from "@/services/authService";

type LogoutResponse = {
  token?: string;
};

export const useLogoutMutation = () => {
  return useMutation<void, Error, LogoutResponse | void>({
    mutationFn: variables => logout(variables?.token),
  });
};
