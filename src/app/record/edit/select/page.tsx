import { EditSelectClient } from "@/components/record/EditSelectClient";
import { fetchCities } from "@/services/cityService";
import { getMemberTravels } from "@/services/memberService";
import type { PageProps } from "@/types/components";
import { getServerAuthInfo } from "@/utils/serverCookies";

export const dynamic = "force-dynamic";

type EditSelectPageProps = PageProps<never, { added?: string; removed?: string }>;

export default async function EditSelectPage({ searchParams }: EditSelectPageProps) {
  try {
    const { token } = await getServerAuthInfo();
    const params = await searchParams;

    // 편집 중 삭제한 도시는 저장 전이라도 다시 추가할 수 있어야 하므로 등록 목록에서 제외한다
    const removedIds = new Set<string>();
    const removedParam = Array.isArray(params?.removed) ? params.removed[0] : params?.removed;
    if (removedParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(removedParam));
        if (Array.isArray(decoded)) decoded.forEach((id: string | number) => removedIds.add(String(id)));
      } catch {
        // 잘못된 removed 파라미터는 무시
      }
    }

    // 이미 등록된 도시 이름 목록 가져오기
    const registeredCityNamesSet = new Set<string>();
    if (token) {
      try {
        const memberTravels = await getMemberTravels(token);
        if (memberTravels) {
          for (const travel of memberTravels.data.travels) {
            for (const city of travel.cities) {
              if (removedIds.has(String(city.cityId))) continue;
              registeredCityNamesSet.add(city.cityName);
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to fetch member travels:", error);
        }
      }
    }

    const initialCities = await fetchCities({ limit: 53 });
    return (
      <EditSelectClient
        initialCities={initialCities}
        registeredCityNames={Array.from(registeredCityNamesSet)}
        addedParam={params?.added}
        removedParam={params?.removed}
      />
    );
  } catch (error) {
    console.error("Failed to fetch initial cities:", error);
    return <EditSelectClient initialCities={[]} registeredCityNames={[]} />;
  }
}
