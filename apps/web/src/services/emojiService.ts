import type {
  PressEmojiParams,
  PressEmojiResponse,
  RegisterEmojiParams,
  RegisterEmojiResponse,
} from "@globber/shared/types/emoji";
import { StatusCodes } from "http-status-codes";

import { ApiError, apiPost } from "@/lib/apiClient";
import { getAuthInfo } from "@/utils/cookies";

/**
 * 다이어리에 이모지를 등록합니다.
 *
 * @param {RegisterEmojiParams} params - 이모지 등록 파라미터
 * @param {string} params.diaryId - 다이어리 ID
 * @param {string} params.code - 이모지 유니코드 (예: "1f600")
 * @param {string} params.glyph - 이모지 글리프 (예: "😀")
 * @returns {Promise<RegisterEmojiResponse>}
 * @throws 이모지 등록 실패 시 에러 발생
 *
 * @example
 * await registerEmoji({ diaryId: "1", code: "1f600", glyph: "😀" });
 */
export const registerEmoji = async (params: RegisterEmojiParams): Promise<RegisterEmojiResponse> => {
  const { token } = getAuthInfo();

  if (!token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    const response = await apiPost<RegisterEmojiResponse>(
      `/api/v1/diaries/${params.diaryId}/emojis/register?code=${params.code}&glyph=${encodeURIComponent(params.glyph)}`,
      undefined,
      token
    );
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error instanceof ApiError && error.status === StatusCodes.CONFLICT)
        throw new Error("이미 등록된 이모지입니다.");
      throw new Error(`이모지 등록에 실패했습니다: ${error.message}`);
    }
    throw new Error("이모지를 등록하는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 이모지를 누릅니다(카운트 증가).
 *
 * @param {PressEmojiParams} params - 이모지 누르기 파라미터
 * @param {string} params.diaryId - 다이어리 ID
 * @param {string} params.code - 이모지 유니코드 (예: "1f600")
 * @returns {Promise<PressEmojiResponse>}
 * @throws 이모지 누르기 실패 시 에러 발생
 *
 * @example
 * await pressEmoji({ diaryId: "1", code: "1f600" });
 */
export const pressEmoji = async (params: PressEmojiParams): Promise<PressEmojiResponse> => {
  const { token } = getAuthInfo();

  if (!token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    const response = await apiPost<PressEmojiResponse>(
      `/api/v1/diaries/${params.diaryId}/emojis/press?code=${params.code}`,
      undefined,
      token
    );
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`이모지 누르기에 실패했습니다: ${error.message}`);
    }
    throw new Error("이모지를 누르는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
