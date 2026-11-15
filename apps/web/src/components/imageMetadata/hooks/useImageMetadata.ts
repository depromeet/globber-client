"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { arrayMove } from "@dnd-kit/sortable";
import type { ImageMetadata, ImageTag } from "@globber/shared/types/imageMetadata";
import { toYearMonth } from "@globber/shared/utils/dateUtils";
import { sendGAEvent } from "@next/third-parties/google";

import { toast } from "@/components/common/GlobalToast";
import { env } from "@/config/env";
import {
  IMAGE_UPLOAD_ERROR_MESSAGE,
  OVERSIZED_IMAGE_MESSAGE,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
  UPLOAD_IMAGE_MAX_SIZE_BYTES,
  UPLOAD_IMAGE_TYPES,
} from "@/constants/image";
import { useUploadTravelPhotoMutation } from "@/hooks/mutation/useDiaryMutations";
import { processSingleFile } from "@/lib/processFile";
import { getDiaryDetail } from "@/services/diaryService";
import { isCoordinateFormat, reverseGeocode } from "@/utils/geocoding";
import { reportError } from "@/utils/sentry";

import type { LocationSelection } from "../LocationSelectBottomSheet";

export type UploadMetadata = ImageMetadata & {
  selectedTag?: ImageTag | null;
  customDate?: string | null;
  photoId?: number;
  photoCode?: string;
  isExisting?: boolean;
  originalImageUrl?: string;
  originalIndex?: number;
  originalPhotoId?: number; // 교체되었거나 크롭된 이미지용
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

type UseImageMetadataProps = {
  diaryId?: number;
  isEditMode: boolean;
};

// 이 화면에서 만든 blob: 미리보기 URL만 해제한다 (S3 주소 등은 그대로 둔다)
const revokePreviewUrl = (url?: string) => {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
};

export const useImageMetadata = ({ diaryId, isEditMode }: UseImageMetadataProps) => {
  const router = useRouter();
  const [metadataList, setMetadataList] = useState<UploadMetadata[]>([]);

  // 화면을 떠날 때 남아 있는 미리보기 URL을 해제하기 위해 최신 목록을 보관한다
  const metadataListRef = useRef(metadataList);
  // 사진 처리·업로드가 끝나기 전에 화면을 떠났는지 확인하기 위한 값
  const isMountedRef = useRef(true);
  useEffect(() => {
    metadataListRef.current = metadataList;
  }, [metadataList]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      metadataListRef.current.forEach(item => {
        revokePreviewUrl(item.imagePreview);
        revokePreviewUrl(item.originalImageUrl);
      });
    };
  }, []);
  const [diaryText, setDiaryText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
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

        const baseUrl = env.S3_BASE_URL;

        // 서버가 저장한 사진 표시 순서(display_order)대로 내려준다
        const sortedPhotos = diary.photos;

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
                // 지오코딩 실패로 일기 로딩이 막히지 않아야 함
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

            const originalIndex = index;

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
          toast.error(error instanceof Error ? error.message : "여행 기록 정보를 불러오지 못했습니다.");
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
      // 처리했지만 목록에 넣지 못한(업로드 실패) 사진의 미리보기 URL을 해제하기 위해 보관한다
      let pendingPreviews: string[] = [];
      try {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const MAX_IMAGES = 3;
        const remainingSlots = MAX_IMAGES - metadataCount;
        if (remainingSlots <= 0) return;

        const tasks: Promise<{ metadata: ImageMetadata; uploadFile: File }>[] = [];
        const filesToProcess = Math.min(files.length, remainingSlots);

        let hasUnsupportedFile = false;
        let hasOversizedFile = false;

        for (let i = 0; i < filesToProcess; i++) {
          const f = files[i];
          // 일부 환경(Windows, Android Chrome 등)은 HEIC의 MIME 타입을 비워 보내므로 확장자로도 확인한다
          const isHeic = /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
          // 서버가 받지 않는 형식(GIF 등)은 업로드 단계에서 400이 나므로 고를 때 바로 안내한다
          if (!isHeic && !UPLOAD_IMAGE_TYPES.includes(f.type)) {
            hasUnsupportedFile = true;
            continue;
          }
          // 서버가 10MB를 넘는 사진을 거절하므로 고를 때 바로 안내한다. HEIC는 JPEG로 바꾼 뒤 크기를 다시 확인한다
          if (!isHeic && f.size > UPLOAD_IMAGE_MAX_SIZE_BYTES) {
            hasOversizedFile = true;
            continue;
          }

          tasks.push(
            processSingleFile(f).then(({ metadata, uploadFile }) => ({
              metadata,
              uploadFile,
            }))
          );
        }

        if (hasUnsupportedFile) toast.error(UNSUPPORTED_IMAGE_TYPE_MESSAGE);

        const settled = await Promise.allSettled(tasks);
        const processed = settled
          .filter(
            (r): r is PromiseFulfilledResult<{ metadata: ImageMetadata; uploadFile: File }> => r.status === "fulfilled"
          )
          .map(r => r.value);

        // HEIC를 JPEG로 바꾼 결과가 10MB를 넘으면 올리지 않고 미리보기 URL을 해제한다
        const results = processed.filter(({ metadata, uploadFile }) => {
          if (uploadFile.size <= UPLOAD_IMAGE_MAX_SIZE_BYTES) return true;
          hasOversizedFile = true;
          revokePreviewUrl(metadata.imagePreview);
          return false;
        });
        if (hasOversizedFile) toast.error(OVERSIZED_IMAGE_MESSAGE);

        const failures = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        failures.forEach(({ reason }) => {
          reportError(reason, { tags: { feature: "photo_upload", step: "process_file" } });
        });
        if (failures.length > 0) {
          toast.error("업로드에 실패했습니다");
        }

        if (results.length === 0) return;
        pendingPreviews = results.map(({ metadata }) => metadata.imagePreview);
        // 처리하는 동안 화면을 떠났으면 목록에 넣지 않고 미리보기 URL만 해제한다
        if (!isMountedRef.current) {
          pendingPreviews.forEach(revokePreviewUrl);
          return;
        }

        // Promise.all은 첫 실패만 넘기므로, 동시에 실패한 업로드도 모두 보고되도록 개별로 보고
        const uploadPromises = results.map(({ metadata, uploadFile }) =>
          uploadTravelPhoto({ file: uploadFile })
            .then(photoCode => ({
              photoCode,
              metadata,
            }))
            .catch(error => {
              reportError(error, { tags: { feature: "photo_upload", step: "upload" } });
              throw error;
            })
        );

        const uploadedResults = await Promise.all(uploadPromises);
        // 업로드하는 동안 화면을 떠났으면 목록에 넣지 않고 미리보기 URL만 해제한다
        if (!isMountedRef.current) {
          pendingPreviews.forEach(revokePreviewUrl);
          return;
        }
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

        pendingPreviews = [];
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
        pendingPreviews.forEach(revokePreviewUrl);
        reportError(error, { tags: { feature: "photo_upload", step: "upload" } });
        toast.error(IMAGE_UPLOAD_ERROR_MESSAGE);
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

    revokePreviewUrl(target.imagePreview);
    revokePreviewUrl(target.originalImageUrl);
    setMetadataList(prev => prev.filter(item => item.id !== id));
  };

  const handleImageUpdate = async (id: string, croppedImageBlobUrl: string) => {
    const targetMetadata = metadataList.find(item => item.id === id);
    if (!targetMetadata) return;

    try {
      let blob: Blob;
      try {
        blob = await fetch(croppedImageBlobUrl).then(res => res.blob());
      } finally {
        // 자른 결과 URL은 파일로 읽은 뒤에는 쓰지 않는다
        URL.revokeObjectURL(croppedImageBlobUrl);
      }
      const croppedFile = new File([blob], targetMetadata.fileName, { type: "image/jpeg" });
      // 자른 결과도 서버 최대 크기를 넘으면 올리지 않고 원래 사진을 그대로 둔다
      if (croppedFile.size > UPLOAD_IMAGE_MAX_SIZE_BYTES) {
        toast.error(OVERSIZED_IMAGE_MESSAGE);
        return;
      }

      const newPhotoCode = await uploadTravelPhoto({ file: croppedFile });

      const baseUrl = env.S3_BASE_URL;
      const newImageUrl = `${baseUrl}${newPhotoCode}`;

      setMetadataList(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                imagePreview: newImageUrl,
                photoCode: newPhotoCode,
                originalPhotoId: undefined,
                // 자른 사진은 새 사진으로 저장한다. 자르기 전 사진은 저장 목록에서 빠지므로 서버가 삭제한다
                photoId: undefined,
                isExisting: false,
                originalImageUrl: item.originalImageUrl || item.imagePreview,
              }
            : item
        )
      );
    } catch (error) {
      reportError(error, { tags: { feature: "photo_upload", step: "crop_upload" } });
      toast.error("크롭된 이미지 업로드에 실패했습니다. 다시 시도해주세요.");
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
