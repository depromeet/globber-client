import { redirect } from "next/navigation";

import type { City } from "@globber/shared/types/city";
import { buildErrorPagePath } from "@globber/shared/utils/errorType";
import { getCityKey } from "@globber/shared/utils/travelUtils";

import { EditSelectClient } from "@/components/record/EditSelectClient";
import { env } from "@/config/env";
import { ApiError } from "@/lib/apiClient";
import { fetchCities } from "@/services/cityService";
import { getMemberTravels } from "@/services/memberService";
import type { PageProps } from "@/types/components";
import { getServerAuthInfo } from "@/utils/serverCookies";

export const dynamic = "force-dynamic";

type EditSelectPageProps = PageProps<never, { added?: string; removed?: string }>;

export default async function EditSelectPage({ searchParams }: EditSelectPageProps) {
  // 조회에 실패해도 편집 중이던 추가·삭제 선택은 그대로 넘겨 돌아갈 때 잃지 않게 한다 (GLB-389)
  const params = await searchParams;

  // 이미 등록된 도시 키(국가 코드+이름) 목록 가져오기.
  // 내 여행을 불러오지 못하면 이미 등록한 도시를 다시 고를 수 있으므로 목록 대신 실패 안내를 보여 준다
  const registeredCityKeysSet = new Set<string>();
  let isLoadError = false;
  const { token } = await getServerAuthInfo();
  if (token) {
    try {
      // 서버에서는 401·408·5xx면 던지고, 그 밖의 실패(4xx·네트워크)는 null을 돌려준다. 성공 응답은 null이 아니다
      const memberTravels = await getMemberTravels(token);
      if (!memberTravels) throw new Error("내 여행 목록을 불러오지 못했습니다.");
      for (const travel of memberTravels.data.travels) {
        for (const city of travel.cities) {
          registeredCityKeysSet.add(getCityKey(city.countryCode, city.cityName));
        }
      }
    } catch (error) {
      // 로그인이 만료됐으면 다시 시도로 풀리지 않으므로 기존 401 화면으로 보낸다
      if (error instanceof ApiError && error.status === 401) redirect(buildErrorPagePath("401"));
      isLoadError = true;
      if (env.IS_LOCAL_DEV) {
        console.error("Failed to fetch member travels:", error);
      }
    }
  }

  let initialCities: City[] = [];
  if (!isLoadError) {
    try {
      initialCities = await fetchCities({ limit: 53 });
    } catch (error) {
      isLoadError = true;
      console.error("Failed to fetch initial cities:", error);
    }
  }

  return (
    <EditSelectClient
      initialCities={initialCities}
      registeredCityKeys={Array.from(registeredCityKeysSet)}
      addedParam={params?.added}
      removedParam={params?.removed}
      isLoadError={isLoadError}
    />
  );
}
