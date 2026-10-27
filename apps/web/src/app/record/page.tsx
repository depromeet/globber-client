import { cookies } from "next/headers";

import type { RecordResponse } from "@globber/shared/types/record";
import { convertMemberTravelsToRecordResponse } from "@globber/shared/utils/travelUtils";

import { RecordClient } from "@/components/record/RecordClient";
import { getMemberTravels } from "@/services/memberService";
import { handleServerError } from "@/utils/serverErrorHandler";

export const dynamic = "force-dynamic";

export default async function RecordPage() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("kakao_access_token")?.value;

    if (!token) {
      return <RecordClient initialData={null} />;
    }

    const memberTravels = await getMemberTravels(token);

    if (!memberTravels) {
      return <RecordClient initialData={null} />;
    }

    const recordData: RecordResponse = convertMemberTravelsToRecordResponse(memberTravels);
    return <RecordClient initialData={recordData} />;
  } catch (error) {
    // 401/500 에러는 서버에서 직접 리다이렉트 (500 에러 방지)
    handleServerError(error);

    console.error("Failed to fetch record data:", error);
    throw error; // 그 외 에러는 error.tsx로 전파
  }
}
