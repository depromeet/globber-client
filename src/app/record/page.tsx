import { cookies } from "next/headers";

import { RecordClient } from "@/components/record/RecordClient";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { getMemberTravels } from "@/services/memberService";
import type { RecordResponse } from "@/types/record";
import { handleServerError } from "@/utils/serverErrorHandler";
import { convertMemberTravelsToRecordResponse } from "@/utils/travelUtils";

export const dynamic = "force-dynamic";

export default async function RecordPage() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;

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
