import type {
  PressEmojiParams,
  PressEmojiResponse,
  RegisterEmojiParams,
  RegisterEmojiResponse,
} from "@globber/shared/types/emoji";

import { apiPost } from "@/lib/apiClient";
import { getAuthInfo } from "@/utils/cookies";

/**
 * 다이어리에 이모지를 등록합니다. 등록한 사람이 누른 것으로 처리되고(count 1),
 * 이미 있는 이모지면 오류 없이 누른 상태가 됩니다 (백엔드 GLB-156·166·219).
 *
 * @param {RegisterEmojiParams} params - 이모지 등록 파라미터
 * @param {string} params.diaryId - 다이어리 ID
 * @param {string} params.code - 이모지 유니코드 (예: "1f600")
 * @returns {Promise<RegisterEmojiResponse>} 갱신된 이모지 ({code, glyph, count, pressedByMe})
 * @throws 이모지 등록 실패 시 에러 발생
 *
 * @example
 * await registerEmoji({ diaryId: "1", code: "1f600" });
 */
export const registerEmoji = async ({ diaryId, code }: RegisterEmojiParams): Promise<RegisterEmojiResponse> => {
  const { token } = getAuthInfo();

  if (!token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    return await apiPost<RegisterEmojiResponse>(`/api/v1/diaries/${diaryId}/emojis/register`, { code }, token);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`이모지 등록에 실패했습니다: ${error.message}`);
    }
    throw new Error("이모지를 등록하는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 이모지를 누르거나 취소합니다(토글). 누르지 않았으면 count가 1 오르고, 이미 눌렀으면 취소되어 1 내려갑니다.
 *
 * @param {PressEmojiParams} params - 이모지 누르기 파라미터
 * @param {string} params.diaryId - 다이어리 ID
 * @param {string} params.code - 이모지 유니코드 (예: "1f600")
 * @returns {Promise<PressEmojiResponse>} 갱신된 이모지 ({code, glyph, count, pressedByMe})
 * @throws 이모지 누르기 실패 시 에러 발생
 *
 * @example
 * await pressEmoji({ diaryId: "1", code: "1f600" });
 */
export const pressEmoji = async ({ diaryId, code }: PressEmojiParams): Promise<PressEmojiResponse> => {
  const { token } = getAuthInfo();

  if (!token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    return await apiPost<PressEmojiResponse>(`/api/v1/diaries/${diaryId}/emojis/press`, { code }, token);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`이모지 누르기에 실패했습니다: ${error.message}`);
    }
    throw new Error("이모지를 누르는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
