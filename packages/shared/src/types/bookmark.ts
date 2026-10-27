import type { ApiResponse } from "./api";

/**
 * 북마크된 사용자 정보
 *
 * @property {number} memberId - 멤버 ID
 * @property {string} uuid - 멤버 UUID
 * @property {string} nickname - 사용자 닉네임
 * @property {string | undefined} profileImageUrl - 프로필 이미지 URL
 * @property {boolean} bookmarked - 북마크 여부
 */
export interface BookmarkUser {
  memberId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string | undefined;
  bookmarked: boolean;
}

/**
 * 북마크 목록 조회 API 응답
 */
export type BookmarkListResponse = ApiResponse<BookmarkUser[]>;

export type AddBookmarkRequest = {
  targetMemberId: number;
  useToken?: boolean;
};

export type RemoveBookmarkRequest = {
  targetMemberId: number;
};
