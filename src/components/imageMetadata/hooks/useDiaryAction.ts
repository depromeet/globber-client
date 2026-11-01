"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";

import {
  useAddDiaryPhotoMutation,
  useCreateDiaryMutation,
  useDeleteDiaryPhotoMutation,
  useUpdateDiaryMutation,
} from "@/hooks/mutation/useDiaryMutations";
import { ApiError } from "@/lib/apiClient";
import { getDiaryDetail } from "@/services/diaryService";
import { getAuthInfo } from "@/utils/cookies";
import { toYearMonth } from "@/utils/dateUtils";
import { isCoordinateFormat, reverseGeocode } from "@/utils/geocoding";
import { reportError } from "@/utils/sentry";

import type { UploadMetadata } from "./useImageMetadata";

interface UseDiaryActionProps {
  cityId?: number;
  diaryId?: number;
  isEditMode: boolean;
  uuid?: string;
  scrollIndex?: number;
  metadataList: UploadMetadata[];
  setMetadataList: React.Dispatch<React.SetStateAction<UploadMetadata[]>>;
  diaryText: string;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  pendingDeletePhotoIds: number[];
  hasSavedRef?: React.MutableRefObject<boolean>;
}

const buildPhotoPayload = async (metadata: UploadMetadata, fallbackMonth: string, defaultDimension: number = 0) => {
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
      // Geocoding failure should not block saving
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
  setMetadataList,
  diaryText,
  isProcessing,
  setIsProcessing,
  pendingDeletePhotoIds,
  hasSavedRef,
}: UseDiaryActionProps) => {
  const router = useRouter();
  const { mutateAsync: deleteDiaryPhoto } = useDeleteDiaryPhotoMutation();
  const { mutateAsync: addDiaryPhoto } = useAddDiaryPhotoMutation();
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
      if (isEditMode && typeof diaryId === "number") {
        const orderMapping: Record<string, number> = {};
        metadataList.forEach(item => {
          if (item.photoCode && item.originalIndex !== undefined) {
            orderMapping[item.photoCode] = item.originalIndex;
          }
        });
        sessionStorage.setItem(`diary-${diaryId}-photo-order`, JSON.stringify(orderMapping));
      }

      const fallbackMonth = new Date().toISOString().slice(0, 7).replace("-", "");

      let currentMetadataList = metadataList;

      if (isEditMode && typeof diaryId === "number") {
        if (pendingDeletePhotoIds.length > 0) {
          for (const photoId of pendingDeletePhotoIds) {
            await deleteDiaryPhoto({ diaryId, photoId });
          }
          // [Workaround] DB 복제 지연(Replication lag) 등을 고려하여 삭제 후 조금 더 기다림
          await new Promise(r => setTimeout(r, 800));
        }

        const withoutPhotoId = metadataList.filter(item => item.photoId == null);

        if (withoutPhotoId.length > 0) {
          const createdPhotos: { targetId: string; photoId: number }[] = [];

          for (const metadata of withoutPhotoId) {
            const payload = await buildPhotoPayload(metadata, fallbackMonth, 1);

            const createdPhoto = await addDiaryPhoto({ diaryId, photo: payload });
            let resolvedPhotoId = createdPhoto.photoId;

            if (!resolvedPhotoId) {
              console.warn("⚠️  photoId를 응답에서 찾지 못함 → 다이어리 재조회");
              try {
                const latestDiary = await getDiaryDetail(diaryId);
                const matchedPhoto = latestDiary.photos.find(photo => photo.photoCode === metadata.photoCode);
                if (matchedPhoto?.photoId) {
                  resolvedPhotoId = matchedPhoto.photoId;
                  console.log(`✅ 재조회 성공 → photoId: ${resolvedPhotoId}`);
                }
              } catch (fetchError) {
                console.error("❌ 재조회 실패:", fetchError);
              }
            }

            if (!resolvedPhotoId) {
              throw new Error("업로드한 사진 ID를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
            }

            createdPhotos.push({ targetId: metadata.id, photoId: resolvedPhotoId });
          }

          currentMetadataList = metadataList.map(item => {
            const created = createdPhotos.find(c => c.targetId === item.id);
            if (!created) return item;
            return {
              ...item,
              photoId: created.photoId,
              isExisting: true,
              originalPhotoId: undefined,
            };
          });

          setMetadataList(currentMetadataList);
        }
      }

      const sortedMetadataList = [...currentMetadataList].sort((a, b) => {
        const indexA = a.originalIndex ?? Number.MAX_SAFE_INTEGER;
        const indexB = b.originalIndex ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });

      const photos = await Promise.all(
        sortedMetadataList.map(async metadata => {
          const payload = await buildPhotoPayload(metadata, fallbackMonth, 0);

          return {
            photoId: metadata.photoId,
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

      let finalDiaryId = diaryId;
      if (isEditMode && typeof diaryId === "number") {
        await updateDiary({ diaryId, params: payload });
      } else {
        finalDiaryId = await createDiary({ params: payload });
      }

      if (typeof finalDiaryId === "number") {
        const orderMapping: Record<string, number> = {};
        sortedMetadataList.forEach((item, index) => {
          if (item.photoCode) {
            orderMapping[item.photoCode] = index;
          }
        });
        sessionStorage.setItem(`diary-${finalDiaryId}-photo-order`, JSON.stringify(orderMapping));
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
