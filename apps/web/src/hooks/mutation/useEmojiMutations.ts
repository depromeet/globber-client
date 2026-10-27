"use client";

import type {
  PressEmojiParams,
  PressEmojiResponse,
  RegisterEmojiParams,
  RegisterEmojiResponse,
} from "@globber/shared/types/emoji";
import { useMutation } from "@tanstack/react-query";

import { pressEmoji, registerEmoji } from "@/services/emojiService";

export const useRegisterEmojiMutation = () => {
  return useMutation<RegisterEmojiResponse, Error, RegisterEmojiParams>({
    mutationFn: (params: RegisterEmojiParams) => registerEmoji(params),
  });
};

export const usePressEmojiMutation = () => {
  return useMutation<PressEmojiResponse, Error, PressEmojiParams>({
    mutationFn: (params: PressEmojiParams) => pressEmoji(params),
  });
};
