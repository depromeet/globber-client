import type { BookmarkListResponse, BookmarkUser } from "@globber/shared/types/bookmark";

import { apiDelete, ApiError, apiGet, apiPost, apiPostWithHeaders } from "@/lib/apiClient";
import { clearAllCookies, getAuthInfo } from "@/utils/cookies";

/**
 * 북마크된 사용자 목록을 조회합니다.
 *
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @param {boolean} [useToken=true] - 토큰 사용 여부 (기본값: true)
 * @returns {Promise<BookmarkUser[]>} 북마크된 사용자 목록
 * @throws 데이터 조회 실패 시 에러 발생
 *
 * @example
 * // 서버 컴포넌트에서 사용
 * const bookmarks = await getBookmarks(token);
 *
 * // 클라이언트 컴포넌트에서 사용
 * const bookmarks = await getBookmarks();
 *
 * // 토큰 없이 사용 (공개 API)
 * const bookmarks = await getBookmarks(undefined, false);
 */
export const getBookmarks = async (token?: string, useToken = true): Promise<BookmarkUser[]> => {
  let authToken = "";

  // useToken이 true인 경우에만 토큰 사용
  if (useToken) {
    authToken = token || "";

    if (!authToken) {
      const { token: clientToken } = getAuthInfo();
      authToken = clientToken || "";
    }

    if (!authToken) {
      throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
    }
  }

  try {
    const data = await apiGet<BookmarkListResponse>(
      `/api/v1/bookmarks`,
      {},
      authToken,
      { skipGlobalErrorHandling: true } // 401 에러 시 자동 리다이렉트 방지
    );
    return data.data;
  } catch (error) {
    // 401 에러는 조용히 처리 (빈 배열 반환)
    if (error instanceof ApiError && error.status === 401) {
      return [];
    }

    if (error instanceof Error) {
      throw new Error(`북마크 목록을 불러오는데 실패했습니다: ${error.message}`);
    }
    throw new Error("북마크 목록을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 사용자를 북마크에 추가합니다.
 *
 * @param {number} targetMemberId - 북마크할 멤버의 ID
 * @param {boolean} useToken - 토큰 사용 여부 (기본값: true)
 * @returns {Promise<void>}
 * @throws 북마크 추가 실패 시 에러 발생
 *
 * @example
 * await addBookmark(123);
 */
export const addBookmark = async (targetMemberId: number, useToken = true, onLoginGate?: () => void): Promise<void> => {
  let authToken = "";

  if (useToken) {
    const { token } = getAuthInfo();
    authToken = token || "";

    // 토큰이 없으면 바로 토큰 없이 재호출
    if (!authToken) {
      clearAllCookies();
      await addBookmark(targetMemberId, false, onLoginGate);
      return;
    }
  }

  try {
    // useToken이 false인 경우 (토큰 없이 호출)
    if (!useToken) {
      const { headers } = await apiPostWithHeaders(`/api/v1/bookmarks`, { targetMemberId });
      const redirectUrl = headers.get("X-Redirect-URL");
      if (redirectUrl) {
        try {
          onLoginGate?.();
        } finally {
          window.location.href = redirectUrl;
        }
      }

      throw Error; // '저장되었습니다' toast 메시지를 표시하지 않기위해 임의로 에러 발생시킴
    }

    // useToken이 true인 경우 (토큰과 함께 호출)
    await apiPost(`/api/v1/bookmarks`, { targetMemberId }, authToken);
  } catch (error) {
    // useToken이 false인 경우 (이미 재호출된 상태)에는 재호출하지 않음
    if (useToken && error instanceof ApiError && error.status === 401) {
      clearAllCookies();
      await addBookmark(targetMemberId, false, onLoginGate);
      return;
    }
    throw new Error("북마크를 추가하는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 사용자를 북마크에서 제거합니다.
 *
 * @param {number} targetMemberId - 북마크 제거할 멤버의 ID
 * @returns {Promise<void>}
 * @throws 북마크 제거 실패 시 에러 발생
 *
 * @example
 * await removeBookmark(123);
 */
export const removeBookmark = async (targetMemberId: number): Promise<void> => {
  const { token } = getAuthInfo();

  if (!token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    await apiDelete(`/api/v1/bookmarks/${targetMemberId}`, undefined, token);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`북마크 제거에 실패했습니다: ${error.message}`);
    }
    throw new Error("북마크를 제거하는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
