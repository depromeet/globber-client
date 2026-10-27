"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import type { ImageMetadata, ImageTag } from "@globber/shared/types/imageMetadata";
import { formatYearMonth, toYearMonth } from "@globber/shared/utils/dateUtils";
import { sendGAEvent } from "@next/third-parties/google";

import { DeleteConfirmModal } from "@/components/common/DeleteConfirmModal";
import { ImageFallback } from "@/components/common/ImageFallback";
import { HeadlessToast, HeadlessToastProvider } from "@/components/common/Toast";
import { useImageLoadError } from "@/hooks/useImageLoadError";

import { CircleCloseButton } from "./CircleCloseButton";
import { DateSelectBottomSheet } from "./DateSelectBottomSheet";
import { ImageCropModal } from "./ImageCropModal";
import { LocationSelectBottomSheet, type LocationSelection } from "./LocationSelectBottomSheet";
import { MetadataChip } from "./MetadataChip";
import { TagSelector } from "./TagSelector";

const TOAST_DURATION = 1500;

type ExtendedImageMetadata = ImageMetadata & {
  selectedTag?: ImageTag | null;
  customDate?: string | null;
  originalImageUrl?: string;
};

type ImageCarouselProps = {
  image: ExtendedImageMetadata;
  onRemove: (id: string) => void | Promise<void>;
  onTagChange?: (tag: ImageTag | null) => void;
  onDateChange?: (yearMonth: string | null) => void;
  onImageUpdate?: (id: string, croppedImage: string) => void | Promise<void>;
  onLocationChange?: (location: LocationSelection | null) => void;
  isProcessing?: boolean;
  photoIndex?: number;
};

export const ImageCarousel = ({
  image,
  onRemove,
  onTagChange,
  onDateChange,
  onImageUpdate,
  onLocationChange,
  isProcessing = false,
  photoIndex = 0,
}: ImageCarouselProps) => {
  const [selectedTag, setSelectedTag] = useState<ImageTag | null>(
    image.selectedTag ?? (image.tag && image.tag !== "NONE" ? image.tag : null)
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDateSelectModalOpen, setIsDateSelectModalOpen] = useState(false);
  const [isLocationSelectModalOpen, setIsLocationSelectModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isCropUploading, setIsCropUploading] = useState(false);
  const [currentImage, setCurrentImage] = useState(image.imagePreview);
  const [isLoadErrorToastOpen, setIsLoadErrorToastOpen] = useState(false);
  const { hasError: hasImageError, handleError: handleImageError } = useImageLoadError(currentImage);
  const [customDate, setCustomDate] = useState<string | null>(
    image.customDate === undefined ? toYearMonth(image.timestamp) : image.customDate
  );
  const [customLocation, setCustomLocation] = useState<string | null>(
    image.location?.nearbyPlaces?.[1] || image.location?.address || null
  );

  const displayedYearMonth = customDate;
  const displayDate = formatYearMonth(displayedYearMonth);
  const hasDate = !!displayedYearMonth;

  useEffect(() => {
    setSelectedTag(image.selectedTag ?? (image.tag && image.tag !== "NONE" ? image.tag : null));
  }, [image.selectedTag, image.tag]);

  useEffect(() => {
    setCustomDate(image.customDate === undefined ? toYearMonth(image.timestamp) : image.customDate);
  }, [image.customDate, image.timestamp]);

  useEffect(() => {
    setCustomLocation(image.location?.nearbyPlaces?.[1] || image.location?.address || null);
  }, [image.location?.address, image.location?.nearbyPlaces]);

  useEffect(() => {
    setCurrentImage(image.imagePreview);
  }, [image.imagePreview]);

  const handleTagSelect = (tag: ImageTag) => {
    sendGAEvent("event", "record_tag_select", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.tag.select",
      tag_type: tag.toLowerCase(),
    });
    setSelectedTag(tag);
    onTagChange?.(tag);
  };

  const handleTagRemove = () => {
    setSelectedTag(null);
    onTagChange?.(null);
  };

  const formatDateForGA = (yyyymm: string | null): string | null => {
    if (!yyyymm) return null;
    return `${yyyymm.slice(0, 4)}.${yyyymm.slice(4, 6)}`;
  };

  const handleConfirmDate = (date: string) => {
    const normalized = date.replace(".", "");
    const changeType = !displayedYearMonth ? "add" : "update";
    sendGAEvent("event", "record_meta_date_change", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.meta.date.edit",
      date_before: formatDateForGA(displayedYearMonth),
      date_after: formatDateForGA(normalized),
      change_type: changeType,
    });
    setCustomDate(normalized);
    onDateChange?.(normalized);
  };

  const handleDateClear = () => {
    sendGAEvent("event", "record_meta_date_change", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.meta.date.remove",
      date_before: formatDateForGA(displayedYearMonth),
      date_after: null,
      change_type: "remove",
    });
    setCustomDate(null);
    onDateChange?.(null);
  };

  const handleDateChipClick = () => {
    if (hasDate) {
      handleDateClear();
      return;
    }

    setIsDateSelectModalOpen(true);
  };

  const handleSaveCroppedImage = async (croppedImage: string) => {
    setIsCropUploading(true);
    try {
      await onImageUpdate?.(image.id, croppedImage);
    } finally {
      setIsCropUploading(false);
    }
  };

  const handleConfirmLocation = (location: LocationSelection) => {
    const displayName = location.name || location.address;
    const changeType = !customLocation ? "add" : "update";
    sendGAEvent("event", "record_meta_location_change", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.meta.location.edit",
      location_before: customLocation || null,
      location_after: displayName || null,
      change_type: changeType,
    });
    setCustomLocation(displayName);
    onLocationChange?.(location);
  };

  const handleLocationClear = () => {
    sendGAEvent("event", "record_meta_location_change", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.meta.location.remove",
      location_before: customLocation || null,
      location_after: null,
      change_type: "remove",
    });
    setCustomLocation(null);
    onLocationChange?.(null);
  };

  const shown = image;
  const displayLocation = customLocation || "";
  const hasLocation = customLocation !== null;

  const initialLocationSelection = useMemo<LocationSelection | null>(() => {
    const location = image.location;
    if (!location) return null;

    const hasLatitude = typeof location.latitude === "number";
    const hasLongitude = typeof location.longitude === "number";
    if (!hasLatitude || !hasLongitude) return null;

    const formattedAddress =
      (Array.isArray(location.nearbyPlaces) && location.nearbyPlaces.length > 0
        ? location.nearbyPlaces[0]
        : undefined) ||
      location.address ||
      "";
    const mainName =
      (Array.isArray(location.nearbyPlaces) && location.nearbyPlaces.length > 1
        ? location.nearbyPlaces[1]
        : undefined) ||
      location.address ||
      "";

    if (!formattedAddress && !mainName) return null;

    return {
      name: mainName || formattedAddress,
      address: formattedAddress || mainName,
      latitude: location.latitude as number,
      longitude: location.longitude as number,
    };
  }, [image.location]);

  return (
    <div className="relative select-none w-[251px] mx-auto">
      <div className="overflow-hidden rounded-xl border border-white/20" style={{ aspectRatio: "9 / 16" }}>
        <button
          type="button"
          className="w-full h-full bg-black relative cursor-pointer overflow-hidden"
          onClick={() => {
            if (hasImageError) {
              setIsLoadErrorToastOpen(true);
              return;
            }
            sendGAEvent("event", "record_photo_ratio_entry", {
              flow: "editor",
              screen: "record_edit",
              click_code: "editor.record.edit.photo.open_ratio",
            });
            setIsCropModalOpen(true);
          }}
          onContextMenu={e => e.preventDefault()}
          aria-label="이미지 편집"
          disabled={isCropUploading}
        >
          {hasImageError ? (
            <ImageFallback size="md" />
          ) : (
            <Image
              src={currentImage}
              alt={shown.fileName}
              fill
              sizes="251px"
              className="object-cover"
              style={
                {
                  WebkitTouchCallout: "none",
                  WebkitUserDrag: "none",
                  userSelect: "none",
                  pointerEvents: "none",
                } as React.CSSProperties
              }
              unoptimized
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              onError={handleImageError}
            />
          )}
          {isCropUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-white text-sm">업로드 중...</div>
            </div>
          )}
        </button>
      </div>
      <div className="absolute top-3 left-3">
        <TagSelector selectedTag={selectedTag} onSelect={handleTagSelect} onRemove={handleTagRemove} />
      </div>
      <div className="absolute top-3 right-3">
        <CircleCloseButton onClick={() => setIsDeleteModalOpen(true)} disabled={isProcessing} />
      </div>
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          if (isProcessing) return;
          try {
            await onRemove(shown.id);
            setIsDeleteModalOpen(false);
          } catch {
            // 삭제 실패 시 모달 유지 (상위에서 에러 처리)
          }
        }}
        isProcessing={isProcessing}
      />
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 items-start">
        <MetadataChip
          iconType="calendar"
          text={hasDate && displayDate ? displayDate : "날짜 추가"}
          onClick={handleDateChipClick}
          onRemove={hasDate ? handleDateClear : undefined}
          isPlaceholder={!hasDate || !displayDate}
        />
        <MetadataChip
          iconType="location"
          text={displayLocation || "위치 추가"}
          onClick={() => setIsLocationSelectModalOpen(true)}
          onRemove={hasLocation ? handleLocationClear : undefined}
          isPlaceholder={!displayLocation}
        />
      </div>
      <DateSelectBottomSheet
        isOpen={isDateSelectModalOpen}
        onClose={() => setIsDateSelectModalOpen(false)}
        onConfirm={handleConfirmDate}
        photoIndex={photoIndex}
        hasExistingDate={hasDate}
      />
      <LocationSelectBottomSheet
        isOpen={isLocationSelectModalOpen}
        onClose={() => setIsLocationSelectModalOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLocation={initialLocationSelection}
        photoIndex={photoIndex}
        hasExistingLocation={hasLocation}
      />
      <HeadlessToastProvider viewportClassName="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-32px)] max-w-[370px]">
        <HeadlessToast
          open={isLoadErrorToastOpen}
          onOpenChange={setIsLoadErrorToastOpen}
          duration={TOAST_DURATION}
          className="flex items-center w-full h-[48px] rounded-lg border text-white px-4"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderColor: "rgba(255, 255, 255, 0.04)",
            paddingTop: "14px",
            paddingBottom: "14px",
          }}
          contentClassName="font-medium text-sm leading-none flex items-center"
        >
          사진을 불러오지 못해 편집할 수 없어요
        </HeadlessToast>
      </HeadlessToastProvider>
      {isCropModalOpen && (
        <ImageCropModal
          image={image.originalImageUrl || currentImage}
          onClose={() => setIsCropModalOpen(false)}
          onSave={handleSaveCroppedImage}
          photoIndex={photoIndex}
        />
      )}
    </div>
  );
};
