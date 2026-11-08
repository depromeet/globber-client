"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

import { toYearMonth } from "@globber/shared/utils/dateUtils";
import { sendGAEvent } from "@next/third-parties/google";

import { useCreateDiaryMutation, useUpdateDiaryMutation } from "@/hooks/mutation/useDiaryMutations";
import { ApiError } from "@/lib/apiClient";
import { getAuthInfo } from "@/utils/cookies";
import { isCoordinateFormat, reverseGeocode } from "@/utils/geocoding";
import { reportError } from "@/utils/sentry";

import type { UploadMetadata } from "./useImageMetadata";

type UseDiaryActionProps = {
  cityId?: number;
  diaryId?: number;
  isEditMode: boolean;
  uuid?: string;
  scrollIndex?: number;
  metadataList: UploadMetadata[];
  diaryText: string;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  hasSavedRef?: React.MutableRefObject<boolean>;
};

// 서버가 width·height를 1 이상으로 받으므로, 크기를 모르는 사진은 1로 보낸다 (실제 크기 측정은 GLB-277)
const buildPhotoPayload = async (metadata: UploadMetadata, fallbackMonth: string, defaultDimension: number = 1) => {
  if (!metadata.photoCode) {
    throw new Error("사진 정보가 없습니다. 다시 시도해주세요.");
  }

  const { location, dimensions, customDate, timestamp, selectedTag, tag } = metadata;
  const width = dimensions?.width ?? defaultDimension;
  const height = dimensions?.height ?? defaultDimension;
  const takenMonth =
    customDate !== null && customDate !== undefined
      ? customDate
      : customDate === null
        ? null
        : (toYearMonth(timestamp) ?? fallbackMonth);
  const normalizedTag = selectedTag ?? tag ?? "NONE";
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  let placeName = location?.address;

  if ((!placeName || isCoordinateFormat(placeName)) && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    try {
      const geocodedName = await reverseGeocode(latitude!, longitude!);
      placeName = geocodedName ?? undefined;
    } catch {
      // 지오코딩 실패로 저장이 막히지 않아야 함
    }
  }

  const finalPlaceName =
    placeName && typeof placeName === "string" && placeName.trim() && !isCoordinateFormat(placeName)
      ? placeName.trim()
      : undefined;

  return {
    photoCode: metadata.photoCode,
    lat: latitude,
    lng: longitude,
    width,
    height,
    takenMonth,
    tag: normalizedTag,
    ...(finalPlaceName && { placeName: finalPlaceName }),
  };
};

export const useDiaryAction = ({
  cityId,
  diaryId,
  isEditMode,
  uuid,
  scrollIndex,
  metadataList,
  diaryText,
  isProcessing,
  setIsProcessing,
  hasSavedRef,
}: UseDiaryActionProps) => {
  const router = useRouter();
  const { mutateAsync: updateDiary } = useUpdateDiaryMutation();
  const { mutateAsync: createDiary } = useCreateDiaryMutation();

  const saveStartedRef = useRef(false);
  const saveCompletedRef = useRef(false);
  const savePhotoCountRef = useRef(0);
  const saveTextLengthRef = useRef(0);

  const isCityIdValid = typeof cityId === "number" && Number.isFinite(cityId) && cityId > 0;

  const handleSave = async () => {
    if (isProcessing) return;
    if (!isCityIdValid) {
      alert("도시 정보가 없습니다. 기록을 생성할 수 없어요.");
      return;
    }
    if (metadataList.length === 0) {
      alert("업로드된 이미지가 없습니다.");
      return;
    }

    saveStartedRef.current = true;
    saveCompletedRef.current = false;
    savePhotoCountRef.current = metadataList.length;
    saveTextLengthRef.current = diaryText.length;

    const saveStartTime = Date.now();
    const hasDate = metadataList.some(item => !!item.customDate);
    const hasLocation = metadataList.some(item => !!(item.location?.address || item.location?.latitude));

    sendGAEvent("event", "record_save_start", {
      flow: "editor",
      screen: "record_save",
      photo_count: metadataList.length,
      text_length: diaryText.length,
      has_date: hasDate,
      has_location: hasLocation,
    });

    setIsProcessing(true);

    try {
      const fallbackMonth = new Date().toISOString().slice(0, 7).replace("-", "");

      // 화면에 보이는 순서가 저장 순서다. 서버는 photos 배열 순서(0부터)를 사진 표시 순서로 저장한다
      const sortedMetadataList = [...metadataList].sort((a, b) => {
        const indexA = a.originalIndex ?? Number.MAX_SAFE_INTEGER;
        const indexB = b.originalIndex ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });

      // 수정은 최종 사진 목록을 PUT 한 번으로 보낸다 (백엔드 GLB-165). photoId가 있으면 기존 사진 유지·수정,
      // 없으면 새 사진 추가, 목록에 없는 기존 사진(삭제·교체·자르기 전 원본)은 서버가 삭제한다
      const photos = await Promise.all(
        sortedMetadataList.map(async metadata => {
          const payload = await buildPhotoPayload(metadata, fallbackMonth);

          return {
            ...(metadata.photoId != null && { photoId: metadata.photoId }),
            ...payload,
          };
        })
      );

      const validCityId = cityId as number;
      const payload = {
        cityId: validCityId,
        text: diaryText || undefined,
        photos,
      };

      if (isEditMode && typeof diaryId === "number") {
        await updateDiary({ diaryId, params: payload });
      } else {
        await createDiary({ params: payload });
      }

      const finalUuid = uuid || getAuthInfo().uuid;
      const params = new URLSearchParams();
      if (finalUuid) {
        params.set("uuid", finalUuid);
      }
      if (typeof scrollIndex === "number") {
        params.set("scrollIndex", String(scrollIndex));
      }
      const queryString = params.toString();
      const nextPath = queryString ? `/record/${validCityId}?${queryString}` : `/record/${validCityId}`;

      sendGAEvent("event", "record_save_complete", {
        flow: "editor",
        screen: "record_save",
        photo_count: metadataList.length,
        text_length: diaryText.length,
        duration_ms: Date.now() - saveStartTime,
      });
      saveCompletedRef.current = true;
      if (hasSavedRef) hasSavedRef.current = true;

      router.push(nextPath);
    } catch (error) {
      saveCompletedRef.current = true;
      const errorCode = error instanceof ApiError ? String(error.status) : "UNKNOWN";
      reportError(error, {
        tags: { feature: "record_save", mode: isEditMode ? "edit" : "create" },
        extra: { photoCount: metadataList.length },
      });
      sendGAEvent("event", "record_save_fail", {
        flow: "editor",
        screen: "record_save",
        error_code: errorCode,
      });
      alert(error instanceof Error ? error.message : "여행기록 저장에 실패했습니다.");
      setIsProcessing(false);
    }
  };

  return { handleSave, saveStartedRef, saveCompletedRef, savePhotoCountRef, saveTextLengthRef };
};
