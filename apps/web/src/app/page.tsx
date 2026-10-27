import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MemberTravelsResponse } from "@globber/shared/types/member";

import { getMemberTravels } from "@/services/memberService";
import { handleServerError } from "@/utils/serverErrorHandler";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("kakao_access_token")?.value;
  const memberId = cookieStore.get("member_id")?.value;
  const uuid = cookieStore.get("uuid")?.value;

  if (token && memberId && uuid) {
    let travelData: MemberTravelsResponse | null = null;

    try {
      // 멤버 여행 데이터 조회
      travelData = await getMemberTravels(token);
    } catch (error) {
      // API 호출 실패 시 에러 타입에 따라 에러 페이지로 이동 (401 또는 500)
      handleServerError(error);
      // handleServerError가 리다이렉트하지 않은 경우 nation-select로 이동
      redirect("/nation-select");
    }

    // 여행 데이터 유무에 따른 라우팅
    if (travelData?.data?.travels && travelData.data.travels.length > 0) {
      redirect(`/globe/${uuid}`);
    } else {
      redirect("/nation-select");
    }
  } else {
    // 토큰이 없으면 로그인 페이지로 이동
    redirect("/login");
  }
}
