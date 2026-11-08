import type { ApiResponse } from "./api";

/**
 * 이모지 정보
 *
 * @property {string} code - 이모지 유니코드 (예: "1f600")
 * @property {string} glyph - 이모지 글리프 (예: "😀")
 * @property {number} count - 이모지를 누른 사람 수
 * @property {boolean} pressedByMe - 조회한 사람이 이 이모지를 눌렀는지 (비로그인이면 false, 백엔드 GLB-156·166·219)
 */
export type Emoji = {
  code: string;
  glyph: string;
  count: number;
  pressedByMe?: boolean;
};

/**
 * 이모지 등록 API 요청 파라미터
 *
 * @property {string} diaryId - 다이어리 ID
 * @property {string} code - 이모지 유니코드 (예: "1f600"). glyph는 서버가 code로 만든다
 */
export type RegisterEmojiParams = {
  diaryId: string;
  code: string;
};

/**
 * 이모지 등록 API 응답
 */
export type RegisterEmojiResponse = ApiResponse<Emoji>;

/**
 * 이모지 누르기(카운트 증가) API 요청 파라미터
 *
 * @property {string} diaryId - 다이어리 ID
 * @property {string} code - 이모지 유니코드 (예: "1f600")
 */
export type PressEmojiParams = {
  diaryId: string;
  code: string;
};

/**
 * 이모지 누르기(카운트 증가) API 응답
 */
export type PressEmojiResponse = ApiResponse<Emoji>;
