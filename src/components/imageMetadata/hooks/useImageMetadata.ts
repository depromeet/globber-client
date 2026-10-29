"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { arrayMove } from "@dnd-kit/sortable";
import { sendGAEvent } from "@next/third-parties/google";

import { IMAGE_UPLOAD_ERROR_MESSAGE } from "@/constants/image";
import { useUploadTravelPhotoMutation } from "@/hooks/mutation/useDiaryMutations";
import { processSingleFile } from "@/lib/processFile";
import { getDiaryDetail } from "@/services/diaryService";
import type { ImageMetadata, ImageTag } from "@/types/imageMetadata";
import { toYearMonth } from "@/utils/dateUtils";
import { isCoordinateFormat, reverseGeocode } from "@/utils/geocoding";

import type { LocationSelection } from "../LocationSelectBottomSheet";

export type UploadMetadata = ImageMetadata & {
  selectedTag?: ImageTag | null;
  customDate?: string | null;
  photoId?: number;
  photoCode?: string;
  isExisting?: boolean;
  originalImageUrl?: string;
  originalIndex?: number;
  originalPhotoId?: number; // For replaced/cropped images
};

const normalizeTakenMonth = (value: string | { year: number; monthValue: number } | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") {
    const digitsOnly = value.replace(/\D/g, "");
    return digitsOnly.length >= 6 ? digitsOnly.slice(0, 6) : null;
  }
  const { year, monthValue } = value;
  if (!year || !monthValue) return null;
  return `${year}${String(monthValue).padStart(2, "0")}`;
};

interface UseImageMetadataProps {
  diaryId?: number;
  isEditMode: boolean;
}

export const useImageMetadata = ({ diaryId, isEditMode }: UseImageMetadataProps) => {
  const router = useRouter();
  const [metadataList, setMetadataList] = useState<UploadMetadata[]>([]);
  const [diaryText, setDiaryText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [pendingDeletePhotoIds, setPendingDeletePhotoIds] = useState<number[]>([]);
  const fileUploadId = useId();

  const { mutateAsync: uploadTravelPhoto } = useUploadTravelPhotoMutation();

  const metadataCount = metadataList.length;

  useEffect(() => {
    if (!isEditMode || typeof diaryId !== "number") return;
    let isCancelled = false;

    const fetchDiaryDetail = async () => {
      setIsInitialLoading(true);
      try {
        const diary = await getDiaryDetail(diaryId);
        if (isCancelled) return;

        setDiaryText(diary.text ?? "");

        const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || "https://globber-dev.s3.ap-northeast-2.amazonaws.com/";

        const photoCodeToIndexMap = new Map<string, number>();
        const savedOrder = sessionStorage.getItem(`diary-${diaryId}-photo-order`);
        if (savedOrder) {
          const orderMapping = JSON.parse(savedOrder) as Record<string, number>;
          Object.entries(orderMapping).forEach(([photoCode, index]) => {
            photoCodeToIndexMap.set(photoCode, index);
          });
        }

        const sortedPhotos = [...diary.photos].sort((a, b) => {
          const indexA = photoCodeToIndexMap.get(a.photoCode) ?? Number.MAX_SAFE_INTEGER;
          const indexB = photoCodeToIndexMap.get(b.photoCode) ?? Number.MAX_SAFE_INTEGER;

          if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) {
            return indexA - indexB;
          }
          if (indexA === Number.MAX_SAFE_INTEGER && indexB === Number.MAX_SAFE_INTEGER) {
            return a.photoId - b.photoId;
          }
          return indexA === Number.MAX_SAFE_INTEGER ? 1 : -1;
        });

        const mappedMetadata = await Promise.all(
          sortedPhotos.map(async (photo, index) => {
            const takenMonth = normalizeTakenMonth(
              typeof photo.takenMonth === "string"
                ? photo.takenMonth
                : photo.takenMonth
                  ? { year: photo.takenMonth.year, monthValue: photo.takenMonth.monthValue }
                  : null
            );

            const hasLat = typeof photo.lat === "number" && Number.isFinite(photo.lat);
            const hasLng = typeof photo.lng === "number" && Number.isFinite(photo.lng);

            let placeName = photo.placeName && !isCoordinateFormat(photo.placeName) ? photo.placeName : null;

            if (!placeName && hasLat && hasLng) {
              try {
                const geocodedName = await reverseGeocode(photo.lat, photo.lng);
                placeName = geocodedName;
              } catch {
                // Geocoding failure should not block diary loading
              }
            }

            const location =
              hasLat || hasLng || placeName
                ? {
                    latitude: hasLat ? photo.lat : undefined,
                    longitude: hasLng ? photo.lng : undefined,
                    altitude: undefined,
                    address: placeName ?? undefined,
                    nearbyPlaces: placeName ? [placeName, placeName] : undefined,
                  }
                : undefined;

            const originalIndex = photoCodeToIndexMap.get(photo.photoCode) ?? index;

            return {
              id: `existing-${photo.photoId}-${index}`,
              fileName: photo.photoCode.split("/").pop() ?? `photo-${photo.photoId}`,
              fileSize: 0,
              fileType: "image/jpeg",
              imagePreview: `${baseUrl}${photo.photoCode}`,
              dimensions:
                photo.width && photo.height
                  ? {
                      width: photo.width,
                      height: photo.height,
                    }
                  : undefined,
              location,
              timestamp: undefined,
              tag: photo.tag ?? "NONE",
              status: "completed" as const,
              selectedTag: photo.tag && photo.tag !== "NONE" ? photo.tag : null,
              customDate: takenMonth,
              photoId: photo.photoId,
              photoCode: photo.photoCode,
              isExisting: true,
              originalIndex,
            };
          })
        );

        setMetadataList(mappedMetadata);
      } catch (error) {
        if (!isCancelled) {
          alert(error instanceof Error ? error.message : "여행 기록 정보를 불러오지 못했습니다.");
          router.back();
        }
      } finally {
        if (!isCancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    fetchDiaryDetail();

    return () => {
      isCancelled = true;
    };
  }, [diaryId, isEditMode, router]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsProcessing(true);
      try {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const MAX_IMAGES = 3;
        const remainingSlots = MAX_IMAGES - metadataCount;
        if (remainingSlots <= 0) return;

        const tasks: Promise<{ metadata: ImageMetadata; uploadFile: File }>[] = [];
        const filesToProcess = Math.min(files.length, remainingSlots);

        for (let i = 0; i < filesToProcess; i++) {
          const f = files[i];
          if (f.type.startsWith("image/")) {
            tasks.push(
              processSingleFile(f).then(({ metadata, uploadFile }) => ({
                metadata,
                uploadFile,
              }))
            );
          }
        }

        const settled = await Promise.allSettled(tasks);
        const results = settled
          .filter(
            (r): r is PromiseFulfilledResult<{ metadata: ImageMetadata; uploadFile: File }> => r.status === "fulfilled"
          )
          .map(r => r.value);

        const hasFailure = settled.some(r => r.status === "rejected");
        if (hasFailure) {
          alert("업로드에 실패했습니다");
        }

        if (results.length === 0) return;

        const uploadPromises = results.map(({ metadata, uploadFile }) =>
          uploadTravelPhoto({ file: uploadFile }).then(photoCode => ({
            photoCode,
            metadata,
          }))
        );

        const uploadedResults = await Promise.all(uploadPromises);
        const currentLength = metadataList.length;
        const mappedMetadata = uploadedResults.map(({ metadata, photoCode }, index) => {
          const selectedTag = metadata.tag && metadata.tag !== "NONE" ? metadata.tag : null;
          const baseTakenMonth = toYearMonth(metadata.timestamp);

          return {
            ...metadata,
            selectedTag,
            customDate: baseTakenMonth ?? null,
            photoCode,
            photoId: undefined,
            isExisting: false,
            originalIndex: currentLength + index,
          };
        });

        setMetadataList(prev => {
          if (prev.length > 0) {
            const updatedPrev = prev.map((item, idx) => ({
              ...item,
              originalIndex: item.originalIndex ?? idx,
            }));
            return [...updatedPrev, ...mappedMetadata];
          }
          return mappedMetadata;
        });

        const newCount = metadataCount + mappedMetadata.length;
        sendGAEvent("event", "record_photo_add", {
          flow: "editor",
          screen: "record_edit",
          click_code: "editor.record.edit.photo.add",
          photo_count: newCount,
        });
        if (newCount >= MAX_IMAGES) {
          sendGAEvent("event", "record_photo_limit_reached", {
            flow: "editor",
            screen: "record_edit",
            click_code: "editor.record.edit.photo.add",
            photo_count: 3,
          });
        }
      } catch (error) {
        console.error("이미지 업로드 실패", error);
        alert(IMAGE_UPLOAD_ERROR_MESSAGE);
      } finally {
        (e.target as HTMLInputElement).value = "";
        setIsProcessing(false);
      }
    },
    [metadataCount, metadataList.length, uploadTravelPhoto]
  );

  const handleRemove = (id: string) => {
    const target = metadataList.find(item => item.id === id);
    if (!target) return;

    if (target.photoId && isEditMode) {
      setPendingDeletePhotoIds(prev => [...prev, target.photoId!]);
    }

    setMetadataList(prev => prev.filter(item => item.id !== id));
  };

  const handleImageUpdate = async (id: string, croppedImageBlobUrl: string) => {
    const targetMetadata = metadataList.find(item => item.id === id);
    if (!targetMetadata) return;

    try {
      const blob = await fetch(croppedImageBlobUrl).then(res => res.blob());
      const croppedFile = new File([blob], targetMetadata.fileName, { type: "image/jpeg" });

      const newPhotoCode = await uploadTravelPhoto({ file: croppedFile });

      const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || "https://globber-dev.s3.ap-northeast-2.amazonaws.com/";
      const newImageUrl = `${baseUrl}${newPhotoCode}`;

      if (targetMetadata.photoId && isEditMode) {
        setPendingDeletePhotoIds(prev => [...prev, targetMetadata.photoId!]);
      }

      setMetadataList(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                imagePreview: newImageUrl,
                photoCode: newPhotoCode,
                originalPhotoId: undefined, // pendingDeletePhotoIds가 처리하므로 undefined
                photoId: undefined,
                isExisting: false,
                originalImageUrl: item.originalImageUrl || item.imagePreview,
              }
            : item
        )
      );
    } catch (error) {
      alert("크롭된 이미지 업로드에 실패했습니다. 다시 시도해주세요.");
      throw error;
    }
  };

  const handleTagChange = (id: string, tag: ImageTag | null) => {
    setMetadataList(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          selectedTag: tag,
          tag: tag ?? "NONE",
        };
      })
    );
  };

  const handleDateChange = (id: string, yearMonth: string | null) => {
    setMetadataList(prev => prev.map(item => (item.id === id ? { ...item, customDate: yearMonth } : item)));
  };

  const handleLocationChange = (id: string, location: LocationSelection | null) => {
    setMetadataList(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (!location) {
          return { ...item, location: undefined };
        }

        const displayName = location.name || location.address || "";
        const formattedAddress = location.address || location.name || "";
        const uniquePlaces = [formattedAddress, displayName].filter(
          (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index
        );

        return {
          ...item,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            altitude: item.location?.altitude,
            address: displayName || formattedAddress,
            nearbyPlaces: uniquePlaces.length > 0 ? uniquePlaces : undefined,
          },
        };
      })
    );
  };

  const handleReorder = useCallback((oldIndex: number, newIndex: number) => {
    setMetadataList(items => {
      const reordered = arrayMove(items, oldIndex, newIndex);
      return reordered.map((item, index) => ({
        ...item,
        originalIndex: index,
      }));
    });
  }, []);

  return {
    metadataList,
    setMetadataList,
    diaryText,
    setDiaryText,
    isProcessing,
    setIsProcessing,
    isInitialLoading,
    pendingDeletePhotoIds,
    fileUploadId,
    metadataCount,
    handleFileUpload,
    handleRemove,
    handleImageUpdate,
    handleTagChange,
    handleDateChange,
    handleLocationChange,
    handleReorder,
  };
};
