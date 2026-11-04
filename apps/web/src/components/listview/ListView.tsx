"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { getContinent, getCountryName } from "@globber/shared/constants/countryMapping";
import type { KoreanContinent } from "@globber/shared/types/geography";
import type { TravelPattern } from "@globber/shared/types/travelPatterns";
import { sendGAEvent } from "@next/third-parties/google";

import { ImageFallback } from "@/components/common/ImageFallback";
import { useImageLoadError } from "@/hooks/useImageLoadError";
import { buildCityNavigationPath } from "@/lib/globe/eventHandlers";

const CONTINENTS: KoreanContinent[] = ["아시아", "유럽", "북아메리카", "남아메리카", "오세아니아", "아프리카"];

const CONTINENT_DISPLAY_NAME: Record<KoreanContinent, string> = {
  아시아: "아시아",
  유럽: "유럽",
  북아메리카: "북미",
  남아메리카: "남미",
  오세아니아: "오세아니아",
  아프리카: "아프리카",
};

type ListViewProps = {
  travelPatterns: TravelPattern[];
  isMyGlobe?: boolean;
  uuid?: string;
};

type GroupedByCountry = {
  countryCode: string;
  countryName: string;
  flag: string;
  continent: KoreanContinent | string;
  cities: Array<{
    name: string;
    lat: number;
    lng: number;
    thumbnailUrl?: string;
    thumbnails?: string[]; // 여행기록 썸네일 배열 (최대 2개, 최신순)
    recordCount?: number; // 해당 도시의 총 여행 기록 개수
    hasRecords: boolean;
    cityId?: number;
  }>;
};

const CityThumbnail = ({ src, alt }: { src: string; alt: string }) => {
  const { hasError, handleError } = useImageLoadError(src);

  if (hasError) {
    return <ImageFallback className="rounded-sm" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={24}
      height={24}
      className="w-full h-full object-cover rounded-sm"
      onError={handleError}
    />
  );
};

const ListView = ({ travelPatterns, isMyGlobe = true, uuid }: ListViewProps) => {
  const router = useRouter();
  const [selectedContinent, setSelectedContinent] = useState<KoreanContinent | "전체">("전체");

  // travelPatterns의 countries를 countryCode로 그룹화
  const groupedCountries = useMemo(() => {
    const groups: Map<string, GroupedByCountry> = new Map();

    travelPatterns.forEach(pattern => {
      pattern.countries.forEach(country => {
        if (!groups.has(country.id)) {
          groups.set(country.id, {
            countryCode: country.id,
            countryName: getCountryName(country.id),
            flag: country.flag,
            continent: getContinent(country.id),
            cities: [],
          });
        }

        const group = groups.get(country.id);
        if (group) {
          group.cities.push({
            name: country.name,
            lat: country.lat,
            lng: country.lng,
            thumbnailUrl: country.thumbnailUrl,
            thumbnails: country.thumbnails,
            recordCount: country.recordCount,
            hasRecords: country.hasRecords ?? false,
            cityId: country.cityId,
          });
        }
      });
    });

    let result = Array.from(groups.values()).sort((a, b) => a.countryName.localeCompare(b.countryName));

    // 대륙으로 필터링
    if (selectedContinent !== "전체") {
      result = result.filter(group => group.continent === selectedContinent);
    }

    return result;
  }, [travelPatterns, selectedContinent]);

  // 대륙별 국가 개수
  const continentCounts = useMemo(() => {
    const counts: Record<KoreanContinent | "전체", number> = {
      전체: 0,
      아시아: 0,
      유럽: 0,
      북아메리카: 0,
      남아메리카: 0,
      오세아니아: 0,
      아프리카: 0,
    };

    const allGrouped: Map<string, GroupedByCountry> = new Map();
    travelPatterns.forEach(pattern => {
      pattern.countries.forEach(country => {
        if (!allGrouped.has(country.id)) {
          allGrouped.set(country.id, {
            countryCode: country.id,
            countryName: getCountryName(country.id),
            flag: country.flag,
            continent: getContinent(country.id),
            cities: [],
          });
        }
      });
    });

    counts.전체 = allGrouped.size;
    allGrouped.forEach(group => {
      if (group.continent in counts) {
        counts[group.continent as KoreanContinent]++;
      }
    });

    return counts;
  }, [travelPatterns]);

  // 여행 기록이 있는 대륙을 앞에, 없는 대륙을 뒤에 배치 (원래 순서 유지)
  const sortedContinents = useMemo(() => {
    const withRecords = CONTINENTS.filter(continent => continentCounts[continent] > 0);
    const withoutRecords = CONTINENTS.filter(continent => continentCounts[continent] === 0);
    return [...withRecords, ...withoutRecords];
  }, [continentCounts]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col gap-0 items-start w-full max-w-lg mx-auto h-full">
        {/* 탭 영역 */}
        <div className="flex gap-2 items-center px-4 pb-5 w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* 전체 탭 */}
          <button
            type="button"
            onClick={() => {
              sendGAEvent("event", "home_list_tab_select", {
                flow: "home",
                screen: isMyGlobe ? "list_main" : "list_other",
                click_code: isMyGlobe ? "home.list.tab.select" : "home.other.list.tab.select",
              });
              setSelectedContinent("전체");
            }}
            className={`px-3.5 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors cursor-pointer ${
              selectedContinent === "전체"
                ? "bg-white text-black"
                : "border border-gray-600 text-white hover:border-gray-400"
            }`}
          >
            전체
          </button>

          {/* 대륙 탭 */}
          {sortedContinents.map(continent => {
            const isDisabled = continentCounts[continent] === 0;
            return (
              <button
                key={continent}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  sendGAEvent("event", "home_list_tab_select", {
                    flow: "home",
                    screen: isMyGlobe ? "list_main" : "list_other",
                    click_code: isMyGlobe ? "home.list.tab.select" : "home.other.list.tab.select",
                  });
                  setSelectedContinent(continent);
                }}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                  isDisabled
                    ? "border border-gray-600 text-gray-600 font-medium cursor-not-allowed opacity-50"
                    : selectedContinent === continent
                      ? "bg-white text-black font-bold cursor-pointer"
                      : "border border-gray-600 text-white font-medium hover:border-gray-400 cursor-pointer"
                }`}
              >
                {CONTINENT_DISPLAY_NAME[continent]}
                <span className="text-xs">{continentCounts[continent]}</span>
              </button>
            );
          })}
        </div>

        {/* 국가 목록 */}
        <div className="flex-1 flex flex-col gap-0 items-start p-4 w-full overflow-y-auto scrollbar-hide">
          {groupedCountries.map(group => (
            <div
              key={group.countryCode}
              className="w-full border-b pt-4 pb-5"
              style={{ borderBottomColor: "rgba(255, 255, 255, 0.04)" }}
            >
              {/* 국가 헤더 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1">
                  <p className="font-bold text-sm text-white tracking-tight">
                    {group.flag} {group.countryName}
                  </p>
                  {group.cities.length > 1 && (
                    <div
                      className="flex items-center justify-center size-5 rounded-[1000px]"
                      style={{ backgroundColor: "rgba(105, 212, 255, 0.3)" }}
                    >
                      <p
                        className="font-medium text-white text-center whitespace-nowrap"
                        style={{ fontSize: "12px", lineHeight: "1.28" }}
                      >
                        {group.cities.length}
                      </p>
                    </div>
                  )}
                </div>

                {/* 도시 칩 목록 */}
                <div className="flex flex-wrap gap-2">
                  {group.cities.map(({ name, hasRecords, thumbnails, recordCount, cityId }) => {
                    // "도시명, 국가명" 형식에서 도시명만 추출
                    const cityName = name.split(",")[0].trim();
                    const totalRecords = recordCount ?? thumbnails?.length ?? 0;
                    const extraCount = totalRecords - 1;
                    // 타인의 지구본에서 기록이 없는 경우 클릭 비활성화 (글로브 뷰와 동일)
                    const isClickDisabled = !isMyGlobe && !hasRecords;

                    return (
                      <button
                        key={`${group.countryCode}-${name}`}
                        type="button"
                        disabled={isClickDisabled}
                        className="border rounded-xl border-none cursor-pointer disabled:cursor-not-allowed"
                        onClick={() => {
                          sendGAEvent("event", "home_list_city_select", {
                            flow: "home",
                            screen: isMyGlobe ? "list_main" : "list_other",
                            click_code: isMyGlobe ? "home.list.city.select" : "home.other.list.city.select",
                          });
                          router.push(buildCityNavigationPath(name, cityId, hasRecords, uuid));
                        }}
                      >
                        <div
                          className="flex gap-2 items-center rounded-[inherit] bg-(--color-surface-placeholder--8)"
                          style={{
                            paddingLeft: "12px",
                            paddingRight: hasRecords && thumbnails ? "8px" : "12px",
                            paddingTop: "7px",
                            paddingBottom: "7px",
                            height: "100%",
                            border: "1px solid var(--color-border-absolutewhite--8)",
                          }}
                        >
                          <p
                            className="font-medium text-white"
                            style={{
                              fontSize: "14px",
                              letterSpacing: "-0.28px",
                            }}
                          >
                            {cityName}
                          </p>
                          {/* 여행기록이 있는 경우 가장 최근 썸네일만 표시 */}
                          {hasRecords && thumbnails && thumbnails.length > 0 && (
                            <div
                              className="border rounded-sm shrink-0 overflow-hidden relative"
                              style={{
                                width: "24px",
                                height: "24px",
                                borderColor: "rgba(255, 255, 255, 0.16)",
                              }}
                            >
                              <CityThumbnail src={thumbnails[0]} alt={cityName} />
                              {/* 기록이 2개 이상인 경우 딤드 + 잔여 개수 뱃지 표시 */}
                              {extraCount > 0 && (
                                <div
                                  className="absolute inset-0 flex items-center justify-center"
                                  style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
                                >
                                  <p
                                    className="font-bold text-white"
                                    style={{ fontSize: "12px", letterSpacing: "-0.24px" }}
                                  >
                                    +{extraCount}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListView;
