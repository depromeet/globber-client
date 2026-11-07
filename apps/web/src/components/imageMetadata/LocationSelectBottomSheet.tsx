"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sendGAEvent } from "@next/third-parties/google";
import { Loader2 } from "lucide-react";

import { SearchInput } from "@/components/common/Input";
import { useGoogleMapsScript } from "@/hooks/useGoogleMapsScript";
import { cn } from "@/utils/cn";

import { BaseInputBottomSheet } from "./BaseInputBottomSheet";

export type LocationSelection = {
  placeId?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type LocationSelectBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (location: LocationSelection) => void;
  initialLocation?: LocationSelection | null;
  photoIndex?: number;
  hasExistingLocation?: boolean;
};

export const LocationSelectBottomSheet = ({
  isOpen,
  onClose,
  onConfirm,
  initialLocation,
  photoIndex = 0,
  hasExistingLocation = false,
}: LocationSelectBottomSheetProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasTyped, setHasTyped] = useState(false);

  const {
    isReady,
    isLoading,
    load,
    error: scriptError,
  } = useGoogleMapsScript({
    language: "ko",
    region: "KR",
  });

  const wasOpenRef = useRef(false);
  const searchAttemptCountRef = useRef(0);

  const isInputDisabled = useMemo(() => !isReady || isLoading || !!scriptError, [isReady, isLoading, scriptError]);

  const resetState = useCallback(() => {
    setSearchQuery("");
    setPredictions([]);
    setSelectedLocation(null);
    setActivePlaceId(null);
    setErrorMessage(null);
    setHasTyped(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
    }
  }, [isOpen, load]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      searchAttemptCountRef.current = 0;
      sendGAEvent("event", "record_meta_location_view", {
        flow: "editor",
        screen: "record_edit_meta_location",
        photo_index: photoIndex,
        has_value: hasExistingLocation,
      });
      if (initialLocation) {
        setSelectedLocation(initialLocation);
        setActivePlaceId(initialLocation.placeId ?? null);
        setSearchQuery(initialLocation.name || initialLocation.address || "");
      } else {
        resetState();
      }
    }
    wasOpenRef.current = isOpen;
  }, [initialLocation, isOpen, resetState, photoIndex, hasExistingLocation]);

  useEffect(() => {
    if (!isOpen || !isReady) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setPredictions([]);
      setIsSearching(false);
      setErrorMessage(null);
      setHasTyped(false);
      return;
    }

    setHasTyped(true);
    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          language: "ko",
          region: "KR",
        });
        setIsSearching(false);
        setPredictions(result.suggestions.slice(0, 5));
        setErrorMessage(null);
      } catch (err: unknown) {
        setIsSearching(false);
        setPredictions([]);

        const errorCode = err instanceof Error && "code" in err ? (err as Error & { code: string }).code : "";
        if (errorCode === "RESOURCE_EXHAUSTED") {
          setErrorMessage("잠시 후 다시 시도해주세요. (쿼리 한도 초과)");
        } else if (errorCode === "INVALID_ARGUMENT" || errorCode === "UNAUTHENTICATED") {
          setErrorMessage("Google Maps API 요청이 거부되었습니다. API 키를 확인해주세요.");
        } else {
          setErrorMessage("장소를 검색하는 중 문제가 발생했습니다.");
        }
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, isReady, searchQuery]);

  const handlePredictionSelect = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const placeId = suggestion.placePrediction?.placeId;
    if (!placeId) return;

    setActivePlaceId(placeId);
    setIsFetchingDetails(true);
    setErrorMessage(null);

    try {
      const place = new window.google.maps.places.Place({ id: placeId });
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });

      const lat = place.location?.lat();
      const lng = place.location?.lng();

      if (lat === undefined || lng === undefined) {
        throw new Error("Location not found");
      }

      const mainText = suggestion.placePrediction?.mainText?.text || suggestion.placePrediction?.text?.text || "";
      const secondaryText = suggestion.placePrediction?.secondaryText?.text || "";

      const name = place.displayName || mainText || "선택한 장소";
      const formattedAddress = place.formattedAddress || secondaryText || name;

      const location: LocationSelection = {
        placeId,
        name,
        address: formattedAddress,
        latitude: lat,
        longitude: lng,
      };

      setSelectedLocation(location);
      setActivePlaceId(location.placeId ?? null);
    } catch (err: unknown) {
      setActivePlaceId(null);

      const errorCode = err instanceof Error && "code" in err ? (err as Error & { code: string }).code : "";
      if (errorCode === "NOT_FOUND") {
        setErrorMessage("선택한 장소의 상세 정보를 찾을 수 없습니다.");
      } else if (errorCode === "RESOURCE_EXHAUSTED") {
        setErrorMessage("잠시 후 다시 시도해주세요. (쿼리 한도 초과)");
      } else if (errorCode === "INVALID_ARGUMENT" || errorCode === "UNAUTHENTICATED") {
        setErrorMessage("Google Maps API 요청이 거부되었습니다. API 키를 확인해주세요.");
      } else {
        setErrorMessage("장소 정보를 불러오지 못했습니다.");
      }
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setSelectedLocation(null);
    setActivePlaceId(null);
    searchAttemptCountRef.current += 1;
    sendGAEvent("event", "record_meta_location_search", {
      flow: "editor",
      screen: "record_edit_meta_location",
      click_code: "editor.record.edit.meta.location.search.input.change",
      photo_index: photoIndex,
      search_attempt_count: searchAttemptCountRef.current,
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && predictions.length > 0) {
      event.preventDefault();
      handlePredictionSelect(predictions[0]);
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    sendGAEvent("event", "record_meta_location_confirm", {
      flow: "editor",
      screen: "record_edit_meta_location",
      click_code: "editor.record.edit.meta.location.cta.confirm",
      photo_index: photoIndex,
      has_value: true,
    });
    onConfirm?.(selectedLocation);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const renderStatusMessage = () => {
    if (scriptError) {
      return scriptError.message;
    }
    if (isLoading) {
      return "지도 서비스를 불러오는 중입니다...";
    }
    if (!isReady) {
      return "Google Maps 서비스를 초기화하는 중입니다...";
    }
    return null;
  };

  const statusMessage = renderStatusMessage();

  return (
    <BaseInputBottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="위치 추가"
      isValid={Boolean(selectedLocation)}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0">
          <SearchInput
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="장소를 검색해주세요."
            disabled={isInputDisabled}
            backgroundColor="#1B293E"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide mt-6">
          {statusMessage && (
            <div className="flex flex-col items-center justify-center text-sm text-text-thirdly gap-2">
              {isLoading && <Loader2 className="animate-spin" size={18} />}
              <span>{statusMessage}</span>
            </div>
          )}

          {!statusMessage && (
            <>
              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-text-thirdly">
                  <Loader2 className="animate-spin" size={16} />
                  <span>검색 중...</span>
                </div>
              )}

              {!isSearching && predictions.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {predictions.map((prediction, index) => {
                    const placeId = prediction.placePrediction?.placeId;
                    const isSelected = placeId === (activePlaceId ?? selectedLocation?.placeId ?? null);
                    const mainText =
                      prediction.placePrediction?.mainText?.text ||
                      prediction.placePrediction?.text?.text ||
                      "알 수 없는 장소";
                    const secondaryText = prediction.placePrediction?.secondaryText?.text || "상세 정보 없음";
                    return (
                      <li key={placeId || index}>
                        <button
                          type="button"
                          onClick={() => handlePredictionSelect(prediction)}
                          className={cn(
                            "w-full rounded-2xl border text-left transition-colors cursor-pointer flex flex-col items-start gap-1 px-5 py-[15px]",
                            isSelected
                              ? "border-[#00D9FF] bg-transparent hover:border-[#00D9FF]"
                              : "border-[#243246] bg-transparent hover:border-[#36506C] hover:bg-[#1C2B43]"
                          )}
                        >
                          <div className="text-base font-bold text-white truncate w-full">{mainText}</div>
                          <div className="text-sm text-text-secondary font-medium truncate w-full">{secondaryText}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isSearching && hasTyped && predictions.length === 0 && !errorMessage && (
                <div className="text-sm text-text-thirdly">검색 결과가 없습니다.</div>
              )}

              {errorMessage && (
                <div className="text-sm text-red-400" role="alert">
                  {errorMessage}
                </div>
              )}

              {isFetchingDetails && (
                <div className="flex items-center gap-2 text-sm text-text-thirdly">
                  <Loader2 className="animate-spin" size={16} />
                  <span>장소 정보를 불러오는 중...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BaseInputBottomSheet>
  );
};
