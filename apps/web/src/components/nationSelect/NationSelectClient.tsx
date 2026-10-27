"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { City } from "@globber/shared/types/city";
import { sendGAEvent } from "@next/third-parties/google";

import { SearchInput } from "@/components/common/Input";
import { useCreateMemberTravelsMutation } from "@/hooks/mutation/useMemberMutation";
import { useCitySearch } from "@/hooks/useCitySearch";

import { NationSelectFooter } from "./NationSelectFooter";
import { PopularCitiesList } from "./PopularCitiesList";

type NationSelectClientProps = {
  initialCities: City[];
  registeredCityNames?: string[]; // 이미 등록된 도시 이름 목록
  mode?: "default" | "edit-add";
  onComplete?: (cities: City[]) => void;
  buttonLabel?: string;
  customHeader?: React.ReactNode;
};

export const NationSelectClient = ({
  initialCities,
  registeredCityNames = [],
  mode = "default",
  onComplete,
  buttonLabel,
  customHeader,
}: NationSelectClientProps) => {
  const [selectedCityList, setSelectedCityList] = useState<City[]>([]);
  const router = useRouter();
  const registeredCityNamesSet = new Set(registeredCityNames);

  const selectedCountRef = useRef(0);
  useEffect(() => {
    selectedCountRef.current = selectedCityList.length;
  }, [selectedCityList]);

  const { mutateAsync: createMemberTravels } = useCreateMemberTravelsMutation();
  const { searchResults, isSearching, searchError, searchKeyword, setSearchKeyword, clearSearch, hasSearched } =
    useCitySearch();

  const isSearchingMode = searchKeyword.trim().length > 0;
  const displayCities = isSearchingMode ? searchResults : initialCities;
  const displayError = isSearchingMode ? searchError : null;
  const displayLoading = isSearchingMode ? isSearching : false;

  const selectedCityIds = new Set(selectedCityList.map(city => city.id));

  useEffect(() => {
    if (mode === "default") {
      sendGAEvent("event", "onboarding_placeselect_view", {
        flow: "onboarding",
        screen: "placeselect",
      });
    } else if (mode === "edit-add") {
      sendGAEvent("event", "editor_placeselect_view", {
        flow: "editor",
        screen: "cityadd",
      });
      return () => {
        sendGAEvent("event", "editor_placeselect_exit", {
          flow: "editor",
          screen: "cityadd",
          selected_count: selectedCountRef.current,
        });
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCity = (city: City) => {
    if (selectedCityIds.has(city.id)) return;
    setSelectedCityList(prev => [...prev, { ...city, selected: true }]);
    if (mode === "default") {
      sendGAEvent("event", "place_add", {
        flow: "onboarding",
        screen: "placeselect",
        click_code: isSearchingMode ? "onboarding.placeselect.search.result.add" : "onboarding.placeselect.popular.add",
        selected_count: selectedCityList.length + 1,
      });
    } else if (mode === "edit-add") {
      sendGAEvent("event", "placeselect_city_add", {
        flow: "editor",
        screen: "cityadd",
        click_code: isSearchingMode ? "editor.placeselect.search.result.add" : "editor.placeselect.popular.add",
        selected_count: selectedCityList.length + 1,
      });
    }
  };

  const handleRemoveCity = (cityId: string, source: "list" | "selected" = "list") => {
    setSelectedCityList(prev => prev.filter(city => city.id !== cityId));
    if (mode === "default") {
      sendGAEvent("event", "place_remove", {
        flow: "onboarding",
        screen: "placeselect",
        click_code: isSearchingMode
          ? "onboarding.placeselect.search.result.remove"
          : "onboarding.placeselect.popular.remove",
        selected_count: selectedCityList.length - 1,
      });
    } else if (mode === "edit-add") {
      const clickCode =
        source === "selected"
          ? "editor.placeselect.selected.remove"
          : isSearchingMode
            ? "editor.placeselect.search.result.remove"
            : "editor.placeselect.popular.remove";
      sendGAEvent("event", "placeselect_city_remove", {
        flow: "editor",
        screen: "cityadd",
        click_code: clickCode,
        selected_count: selectedCityList.length - 1,
      });
    }
  };

  const handleCreateGlobe = async () => {
    if (selectedCityList.length === 0) return;

    if (mode === "edit-add" && onComplete) {
      sendGAEvent("event", "placeselect_city_add_confirm_click", {
        flow: "editor",
        screen: "cityadd",
        click_code: "editor.placeselect.cta.confirm",
        selected_count: selectedCityList.length,
      });
      onComplete(selectedCityList);
      return;
    }

    if (mode === "default")
      sendGAEvent("event", "globe_generate_click", {
        flow: "onboarding",
        screen: "placeselect",
        click_code: "onboarding.placeselect.cta.generate",
        selected_count: selectedCityList.length,
      });

    try {
      await createMemberTravels({ cities: selectedCityList });

      if (mode === "default")
        sendGAEvent("event", "globe_generate_complete", {
          flow: "onboarding",
          screen: "loading",
          selected_count: selectedCityList.length,
        });

      router.push(`/globe?count=${selectedCityList.length}`);
    } catch (error) {
      console.error("Failed to create member travels:", error);

      if (mode === "default")
        sendGAEvent("event", "globe_generate_fail", {
          flow: "onboarding",
          screen: "loading",
          selected_count: selectedCityList.length,
        });

      alert("여행 기록 생성에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const hasTrackedSearch = useRef(false);

  useEffect(() => {
    if (!isSearchingMode) {
      hasTrackedSearch.current = false;
      return;
    }
    if (hasSearched && !hasTrackedSearch.current) {
      hasTrackedSearch.current = true;
      if (mode === "default") {
        sendGAEvent("event", "place_search", {
          flow: "onboarding",
          screen: "placeselect",
          click_code: "onboarding.placeselect.search.input",
        });
      } else if (mode === "edit-add") {
        sendGAEvent("event", "placeselect_city_search", {
          flow: "editor",
          screen: "cityadd",
          click_code: "editor.placeselect.search.input",
        });
      }
    }
  }, [hasSearched, isSearchingMode, mode]);

  const handleSearchChange = (value: string) => {
    setSearchKeyword(value);
    if (value.trim().length === 0) {
      clearSearch();
    }
  };

  const handleSearchBlur = () => {
    if (searchKeyword.trim().length === 0 || mode !== "default") return;
    sendGAEvent("event", "place_search_submit", {
      flow: "onboarding",
      screen: "placeselect",
      click_code: "onboarding.placeselect.search.submit",
    });
  };

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-lg h-dvh flex flex-col">
        {customHeader && customHeader}

        {!customHeader && (
          <div className="max-w-lg mx-auto w-full shrink-0">
            <header
              className="w-full px-4 pt-10 pb-[30px] bg-surface-secondary relative"
              style={{
                backgroundColor: "transparent",
                position: "relative",
                zIndex: 20,
              }}
            >
              <h1 className="text-text-primary text-2xl font-bold leading-8">
                그동안 여행했던 도시들을
                <br />
                선택해보세요.
              </h1>
            </header>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 flex justify-center">
          <div className="w-full max-w-lg">
            {!customHeader && (
              <div className="mb-8" onBlur={handleSearchBlur}>
                <SearchInput
                  placeholder="도시/나라를 검색해주세요."
                  value={searchKeyword}
                  onChange={e => handleSearchChange(e.target.value)}
                />
              </div>
            )}

            {customHeader && (
              <div className="mb-8" onBlur={handleSearchBlur}>
                <SearchInput
                  placeholder="도시/나라를 검색해주세요."
                  value={searchKeyword}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="[&>div]:h-[50px]"
                />
              </div>
            )}

            <div>
              <h2 className="text-text-primary text-lg font-bold mb-2.5">
                {isSearchingMode ? `검색 결과 ${searchResults.length}건` : "인기 여행지"}
              </h2>

              {displayError && (
                <div className="text-red-500 text-center py-4" role="alert" aria-live="polite">
                  {isSearchingMode ? "검색 중 오류가 발생했습니다" : "도시를 불러오는 중 오류가 발생했습니다"}
                  <div className="mt-1 text-xs text-text-thirdly wrap-break-word">
                    {typeof displayError === "string" ? displayError : String(displayError)}
                  </div>
                </div>
              )}

              <PopularCitiesList
                cities={displayCities}
                selectedCityIds={selectedCityIds}
                registeredCityNames={registeredCityNamesSet}
                onAddCity={handleAddCity}
                onRemoveCity={handleRemoveCity}
                isLoading={displayLoading}
                isSearching={isSearchingMode && isSearching}
                hasSearched={isSearchingMode && hasSearched}
              />
            </div>
          </div>
        </div>

        <NationSelectFooter
          selectedCities={selectedCityList}
          onRemoveCity={handleRemoveCity}
          onCreateGlobe={handleCreateGlobe}
          buttonLabel={buttonLabel}
          mode={mode}
        />
      </div>
    </main>
  );
};
