import { cookies } from "next/headers";

import { logger } from "@globber/shared/utils/logger";

import { EditClient } from "@/components/record/EditClient";
import { env } from "@/config/env";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { getMemberTravels } from "@/services/memberService";
import { parseJsonQueryParam } from "@/utils/jsonQueryParam";
import { handleServerError } from "@/utils/serverErrorHandler";

type SearchParams = { [key: string]: string | string[] | undefined };

/** 오류 화면의 "다시 시도"가 같은 편집 화면을 다시 열 수 있도록 현재 주소를 만든다 (GLB-135) */
const buildEditPath = (params: SearchParams) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const queryString = query.toString();
  return queryString ? `/record/edit?${queryString}` : "/record/edit";
};

export default async function EditRecordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;
  const resolved = await searchParams;

  let cities: {
    id: string;
    name: string;
    countryCode: string;
    lat: number;
    lng: number;
    cityId?: number;
    isNew?: boolean;
  }[] = [];

  if (token) {
    try {
      const memberTravels = await getMemberTravels(token);
      if (memberTravels) {
        // 원본 데이터에서 cityId를 포함한 도시 정보 추출
        for (const travel of memberTravels.data.travels) {
          for (const city of travel.cities) {
            const { cityId, cityName, countryCode, lat, lng } = city;
            cities.push({
              id: String(cityId),
              name: cityName,
              countryCode,
              lat,
              lng,
              cityId,
            });
          }
        }
      }
    } catch (error) {
      // 401/500 에러는 서버에서 직접 리다이렉트 (500 에러 방지)
      handleServerError(error, buildEditPath(resolved));

      if (env.IS_LOCAL_DEV) {
        logger.error("Failed to fetch member travels:", error);
      }
      // 의도적으로 빈 배열로 fallback
    }
  }

  const addedParam = (Array.isArray(resolved?.added) ? resolved.added[0] : resolved?.added) as string | undefined;
  const removedParam = (Array.isArray(resolved?.removed) ? resolved.removed[0] : resolved?.removed) as
    | string
    | undefined;

  // 원본 도시 목록 저장 (삭제된 도시 정보를 찾기 위해)
  const originalCities = [...cities];

  // 삭제된 도시 ID 목록
  const removedIds = new Set<string>();
  if (removedParam) {
    try {
      const decoded = parseJsonQueryParam(removedParam);
      if (Array.isArray(decoded)) {
        decoded.forEach((id: string | number) => {
          removedIds.add(String(id));
        });
      }
    } catch (error) {
      if (env.IS_LOCAL_DEV) {
        logger.warn("Failed to parse removed param:", removedParam, error);
      }
    }
  }

  // 삭제된 도시 정보 추출 (원본 데이터에서)
  const deletedCities = originalCities.filter(c => removedIds.has(c.id));

  // 삭제된 도시 제외
  cities = cities.filter(c => !removedIds.has(c.id));

  // 추가된 도시 추가
  if (addedParam) {
    try {
      const decoded = parseJsonQueryParam(addedParam);
      if (Array.isArray(decoded)) {
        const added = decoded.map(
          (c: { id: string | number; name: string; countryCode: string; lat: number; lng: number }) => ({
            id: String(c.id),
            name: String(c.name),
            countryCode: String(c.countryCode),
            lat: Number(c.lat),
            lng: Number(c.lng),
            isNew: true,
          })
        );
        const existingIds = new Set(cities.map(c => c.id));
        const merged = [...added.filter(c => !existingIds.has(c.id)), ...cities];
        cities = merged;
      }
    } catch (error) {
      if (env.IS_LOCAL_DEV) {
        logger.warn("Failed to parse added param:", addedParam, error);
      }
    }
  }

  return <EditClient cities={cities} deletedCities={deletedCities} />;
}
