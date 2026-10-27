import { SavedGlobeClient } from "@/components/saved-globe/SavedGlobeClient";
import { getBookmarks } from "@/services/bookmarkService";
import { getServerAuthToken } from "@/utils/serverCookies";

export const dynamic = "force-dynamic";

export default async function SavedGlobePage() {
  try {
    const token = await getServerAuthToken();
    const bookmarks = await getBookmarks(token);

    return <SavedGlobeClient initialBookmarks={bookmarks} />;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "북마크를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.";

    return <SavedGlobeClient initialBookmarks={[]} initialError={errorMessage} />;
  }
}
