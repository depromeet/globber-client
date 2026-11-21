import { SavedGlobeClient } from "@/components/savedGlobe/SavedGlobeClient";
import { getBookmarks } from "@/services/bookmarkService";
import { getServerAuthToken } from "@/utils/serverCookies";
import { handleServerError } from "@/utils/serverErrorHandler";
import { getUserErrorMessage } from "@/utils/userErrorMessage";

export const dynamic = "force-dynamic";

export default async function SavedGlobePage() {
  try {
    const token = await getServerAuthToken();
    const bookmarks = await getBookmarks(token);

    return <SavedGlobeClient initialBookmarks={bookmarks} />;
  } catch (error) {
    // 401은 에러 페이지로 리다이렉트 (redirect()가 throw하므로 이후 코드는 실행되지 않음)
    handleServerError(error);

    const errorMessage = getUserErrorMessage(
      error,
      "저장된 지구본을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요."
    );

    return <SavedGlobeClient initialBookmarks={[]} initialError={errorMessage} />;
  }
}
