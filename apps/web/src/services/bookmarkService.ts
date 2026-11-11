import type { BookmarkListResponse, BookmarkUser } from "@globber/shared/types/bookmark";

import { apiDelete, ApiError, apiGet, apiPost, LoginRequiredError } from "@/lib/apiClient";
import { clearAllCookies, getAuthInfo } from "@/utils/cookies";

/**
 * 북마크된 사용자 목록을 조회합니다.
 *
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @param {boolean} [useToken=true] - 토큰 사용 여부 (기본값: true)
 * @returns {Promise<BookmarkUser[]>} 북마크된 사용자 목록
 * @throws 인증 실패(401) 시 ApiError, 그 외 데이터 조회 실패 시 에러 발생
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
    // 401은 호출부에서 인증 실패로 처리할 수 있도록 상태 코드를 유지한 채 전달
    if (error instanceof ApiError && error.status === 401) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(`북마크 목록을 불러오는데 실패했습니다: ${error.message}`);
    }
    throw new Error("북마크 목록을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

// 로그인 화면으로 보낸다. 남아 있는 만료 쿠키가 있으면 미들웨어가 /login을 막으므로 먼저 지운다
const redirectToLogin = (onLoginGate?: () => void) => {
  clearAllCookies();
  try {
    onLoginGate?.();
  } finally {
    window.location.href = "/login";
  }
};

/**
 * 사용자를 북마크에 추가합니다.
 * 로그인하지 않았거나 토큰이 만료되어 401을 받으면 로그인 화면으로 보냅니다 (백엔드 GLB-321: 비로그인 요청은 401).
 *
 * @param {number} targetMemberId - 북마크할 멤버의 ID
 * @param {() => void} [onLoginGate] - 로그인 화면으로 보내기 직전에 호출 (GA 이벤트 등)
 * @returns {Promise<void>}
 * @throws 북마크 추가 실패 시, 또는 로그인 화면으로 보낼 때 에러 발생 (호출하는 쪽이 저장 완료 안내를 띄우지 않도록)
 *
 * @example
 * await addBookmark(123);
 */
export const addBookmark = async (targetMemberId: number, onLoginGate?: () => void): Promise<void> => {
  const { token } = getAuthInfo();

  if (!token) {
    redirectToLogin(onLoginGate);
    throw new LoginRequiredError();
  }

  try {
    await apiPost(`/api/v1/bookmarks`, { targetMemberId }, token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirectToLogin(onLoginGate);
      throw new LoginRequiredError();
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
