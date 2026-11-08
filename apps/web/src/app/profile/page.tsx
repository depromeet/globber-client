import { buildErrorPagePath } from "@globber/shared/utils/errorType";

import { ProfileClient } from "@/components/profile/ProfileClient";
import { getMyProfile } from "@/services/profileService";
import { getServerAuthToken } from "@/utils/serverCookies";
import { handleServerError } from "@/utils/serverErrorHandler";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  try {
    const token = await getServerAuthToken();
    const userProfile = await getMyProfile(token);

    return <ProfileClient initialProfile={userProfile} />;
  } catch (error) {
    // 401/500 에러는 서버에서 직접 리다이렉트
    // handleServerError는 redirect()를 throw하므로 리다이렉트되면 여기까지 도달하지 않음
    handleServerError(error);

    // handleServerError가 처리하지 않은 에러인 경우에도 에러 페이지로 이동
    console.error("프로필 로드 실패:", error);
    const { redirect } = await import("next/navigation");
    redirect(buildErrorPagePath("500"));
  }
}
