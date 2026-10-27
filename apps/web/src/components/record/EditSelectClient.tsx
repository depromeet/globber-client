"use client";

import { useRouter } from "next/navigation";

import type { City } from "@globber/shared/types/city";

import { Header } from "@/components/common/Header";
import { NationSelectClient } from "@/components/nationSelect/NationSelectClient";

interface EditSelectClientProps {
  initialCities: City[];
  registeredCityNames?: string[];
  addedParam?: string | string[];
  removedParam?: string | string[];
}

export function EditSelectClient({
  initialCities,
  registeredCityNames = [],
  addedParam,
  removedParam,
}: EditSelectClientProps) {
  const router = useRouter();

  const handleBack = () => {
    // 뒤로가기 시 기존 쿼리 파라미터 유지 (이전에 추가한 도시들과 삭제된 도시 정보 유지)
    const existingAddedParam = Array.isArray(addedParam) ? addedParam[0] : addedParam;
    const existingRemovedParam = Array.isArray(removedParam) ? removedParam[0] : removedParam;

    let newUrl = "/record/edit";
    const params = new URLSearchParams();

    if (existingAddedParam) {
      params.set("added", existingAddedParam);
    }
    if (existingRemovedParam) {
      params.set("removed", existingRemovedParam);
    }

    if (params.toString()) {
      newUrl += `?${params.toString()}`;
    }

    router.push(newUrl);
  };

  const handleComplete = (cities: City[]) => {
    // 기존에 추가된 도시들 가져오기
    const existingAddedParam = Array.isArray(addedParam) ? addedParam[0] : addedParam;
    const existingRemovedParam = Array.isArray(removedParam) ? removedParam[0] : removedParam;
    const existingAdded: Array<{
      id: string | number;
      name: string;
      country: string;
      countryCode: string;
      lat: number;
      lng: number;
    }> = [];

    if (existingAddedParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(existingAddedParam));
        if (Array.isArray(decoded)) {
          existingAdded.push(...decoded);
        }
      } catch {}
    }

    // 새로 선택한 도시들
    const newCities = cities.map(({ id, name, country, countryCode, lat, lng }) => ({
      id,
      name,
      country,
      countryCode,
      lat,
      lng,
    }));

    // 기존 도시 + 새 도시 합치기 (중복 제거 - 같은 id는 새 것으로 대체)
    const cityMap = new Map<
      string,
      {
        id: string | number;
        name: string;
        country: string;
        countryCode: string;
        lat: number;
        lng: number;
      }
    >();

    // 기존 도시들 먼저 추가
    existingAdded.forEach(city => {
      cityMap.set(String(city.id), city);
    });

    // 새 도시들로 덮어쓰기 (같은 id면 새 것으로)
    newCities.forEach(city => {
      cityMap.set(String(city.id), city);
    });

    // 합쳐진 배열
    const merged = Array.from(cityMap.values());

    let newUrl = "/record/edit";
    const params = new URLSearchParams();
    params.set("added", JSON.stringify(merged));

    // 삭제된 도시 정보도 유지
    if (existingRemovedParam) {
      params.set("removed", existingRemovedParam);
    }

    newUrl += `?${params.toString()}`;
    router.push(newUrl);
  };

  return (
    <NationSelectClient
      initialCities={initialCities}
      registeredCityNames={registeredCityNames}
      mode="edit-add"
      onComplete={handleComplete}
      buttonLabel="내 지구본에 추가하기"
      customHeader={
        <div className="max-w-lg mx-auto w-full">
          <Header
            variant="navy"
            leftIcon="back"
            onLeftClick={handleBack}
            title="도시 추가"
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 20,
            }}
          />
        </div>
      }
    />
  );
}
