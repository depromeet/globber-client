"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ImageMetadataFromDiary } from "@globber/shared/types/diary";
import type { Emoji } from "@globber/shared/types/emoji";
import { sendGAEvent } from "@next/third-parties/google";

import { DeleteConfirmModal } from "@/components/common/DeleteConfirmModal";
import { HeadlessToastProvider } from "@/components/common/Toast";
import { RecordCard } from "@/components/record/RecordCard";
import { RecordDetailHeader } from "@/components/record/RecordDetailHeader";
import { RecordScrollContainer } from "@/components/record/RecordScrollContainer";
import { RecordScrollHint } from "@/components/record/RecordScrollHint";
import { useDeleteDiaryMutation } from "@/hooks/mutation/useDiaryMutations";
import { useRecordScroll } from "@/hooks/useRecordScroll";

type RecordData = {
  id: string;
  cityId: number;
  city: string;
  country: string;
  images: string[];
  imageMetadata?: ImageMetadataFromDiary[];
  userId: string;
  userName: string;
  userAvatar?: string;
  description?: string;
  reactions?: Emoji[];
};

type RecordDetailClientProps = {
  initialRecords: RecordData[];
  serverError: string | null;
  cityId: number;
  queryUuid: string | null;
  isOwner: boolean;
  initialScrollIndex: number;
};

const RecordDetailClient = ({
  initialRecords,
  serverError,
  cityId,
  queryUuid,
  isOwner,
  initialScrollIndex,
}: RecordDetailClientProps) => {
  const router = useRouter();
  const [countryRecords, setCountryRecords] = useState<RecordData[]>(initialRecords);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reorderedRecords = initialRecords.map(record => {
      const savedOrder = sessionStorage.getItem(`diary-${record.id}-photo-order`);
      if (savedOrder) {
        try {
          const orderMapping = JSON.parse(savedOrder) as Record<string, number>;
          const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || "https://globber-dev.s3.ap-northeast-2.amazonaws.com/";

          const newImages = [...record.images].sort((a, b) => {
            const codeA = a.replace(baseUrl, "");
            const codeB = b.replace(baseUrl, "");
            const indexA = orderMapping[codeA] ?? Number.MAX_SAFE_INTEGER;
            const indexB = orderMapping[codeB] ?? Number.MAX_SAFE_INTEGER;
            if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) {
              return indexA - indexB;
            }
            // fallback keeping existing relative order
            const origA = record.images.indexOf(a);
            const origB = record.images.indexOf(b);
            const fallbackA = indexA === Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER ? 1 : 0;
            const fallbackB = indexB === Number.MAX_SAFE_INTEGER && indexA !== Number.MAX_SAFE_INTEGER ? -1 : 0;
            if (fallbackA !== 0 || fallbackB !== 0) return fallbackA || fallbackB;
            return origA - origB;
          });

          const newMetadata = record.imageMetadata
            ? [...record.imageMetadata].sort((a, b) => {
                const codeA = a.url.replace(baseUrl, "");
                const codeB = b.url.replace(baseUrl, "");
                const indexA = orderMapping[codeA] ?? Number.MAX_SAFE_INTEGER;
                const indexB = orderMapping[codeB] ?? Number.MAX_SAFE_INTEGER;
                if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) {
                  return indexA - indexB;
                }
                const origA = record.imageMetadata!.indexOf(a);
                const origB = record.imageMetadata!.indexOf(b);
                const fallbackA = indexA === Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER ? 1 : 0;
                const fallbackB = indexB === Number.MAX_SAFE_INTEGER && indexA !== Number.MAX_SAFE_INTEGER ? -1 : 0;
                if (fallbackA !== 0 || fallbackB !== 0) return fallbackA || fallbackB;
                return origA - origB;
              })
            : undefined;

          // Check if order changed
          const isChanged = newImages.some((img, idx) => img !== record.images[idx]);
          if (isChanged) {
            return { ...record, images: newImages, imageMetadata: newMetadata };
          }
        } catch {
          return record;
        }
      }
      return record;
    });
    setCountryRecords(reorderedRecords);
  }, [initialRecords]);
  const [hasShownScrollHint, setHasShownScrollHint] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { mutateAsync: deleteDiary } = useDeleteDiaryMutation();

  // 스크롤 상태 관리
  const { currentRecord, currentIndex, hasNext, hasPrevious, showScrollHint, onScroll } = useRecordScroll({
    countryRecords,
    shouldShowHint: hasShownScrollHint,
    initialIndex: initialScrollIndex,
  });

  const isLastRecord = currentIndex === countryRecords.length - 1;
  const shouldShowScrollHint = showScrollHint && !isLastRecord;

  const pageEntryTimeRef = useRef<number | null>(null);
  const maxScrollDepthRef = useRef<number>(0);

  useEffect(() => {
    if (pageEntryTimeRef.current === null) {
      pageEntryTimeRef.current = Date.now();
    }
  }, []);

  const handleScroll = (newIndex: number) => {
    const destinationRecord = countryRecords[newIndex];

    if (newIndex !== currentIndex && destinationRecord) {
      const currentDepth = Math.round((newIndex / Math.max(countryRecords.length - 1, 1)) * 100);
      maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, currentDepth);

      const screen = isOwner ? "my" : "other";
      sendGAEvent("event", isOwner ? "endview_my_scroll" : "endview_other_scroll_vertical", {
        flow: "endview",
        screen,
        click_code: `endview.${screen}.scroll.vertical`,
        record_id: destinationRecord.id,
        city_id: destinationRecord.cityId,
        scroll_depth: maxScrollDepthRef.current,
        dwell_time_ms: Date.now() - (pageEntryTimeRef.current ?? Date.now()),
      });

      setHasShownScrollHint(false);
    }
    onScroll(newIndex);
  };

  const handleBack = () => {
    if (queryUuid) {
      router.push(`/globe/${queryUuid}`);
    } else {
      router.push("/globe");
    }
  };

  if (serverError) {
    return (
      <div className="w-full h-dvh flex flex-col items-center justify-center gap-4 bg-surface-secondary px-4">
        <div className="text-text-primary text-center">
          <p className="text-lg font-semibold mb-2">오류가 발생했습니다</p>
          <p className="text-text-secondary text-sm">{serverError}</p>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-opacity-90 transition-opacity"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!currentRecord) return null;
  const { city, country, id, images, imageMetadata, userName, userAvatar, description, reactions } = currentRecord;

  const handleEdit = () => {
    const params = new URLSearchParams();
    params.set("diaryId", id);
    params.set("cityId", String(cityId));
    params.set("country", country);
    params.set("city", city);
    params.set("scrollIndex", String(currentIndex));
    if (queryUuid) {
      params.set("uuid", queryUuid);
    }
    router.push(`/image-metadata?${params.toString()}`);
  };

  const handleDelete = () => {
    if (!currentRecord) return;
    if (isOwner)
      sendGAEvent("event", "endview_my_delete_click", {
        flow: "endview",
        screen: "my",
        click_code: "endview.my.more.delete",
        record_id: currentRecord.id,
      });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDiary({ diaryId: id });
      router.push("/");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "기록 삭제 중 오류가 발생했습니다";
      alert(errorMessage);
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const recordContent =
    countryRecords.length === 1 ? (
      <RecordCard
        id={id}
        images={images}
        imageMetadata={imageMetadata}
        userName={userName}
        userAvatar={userAvatar}
        description={description}
        reactions={reactions}
        isOwner={isOwner}
        showScrollHint={shouldShowScrollHint}
        isFirstRecord={true}
      />
    ) : (
      <>
        <RecordScrollHint show={shouldShowScrollHint} />
        <RecordScrollContainer
          currentIndex={currentIndex}
          onIndexChange={handleScroll}
          hasNext={hasNext}
          hasPrevious={hasPrevious}
        >
          {countryRecords.map(({ id, images, imageMetadata, userName, userAvatar, description, reactions }, index) => (
            <RecordCard
              key={`${id}-${index}`}
              id={id}
              images={images}
              imageMetadata={imageMetadata}
              userName={userName}
              userAvatar={userAvatar}
              description={description}
              reactions={reactions}
              isOwner={isOwner}
              showScrollHint={shouldShowScrollHint && index === currentIndex}
              isFirstRecord={index === 0}
            />
          ))}
        </RecordScrollContainer>
      </>
    );

  return (
    <HeadlessToastProvider viewportClassName="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[370px] max-w-[calc(100%-32px)]">
      <div className="w-full h-dvh bg-surface-secondary relative max-w-lg mx-auto">
        <div className="absolute top-0 left-0 right-0 z-10">
          <RecordDetailHeader
            city={city}
            country={country}
            onBack={handleBack}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isOwner={isOwner}
          />
        </div>
        {recordContent}
      </div>
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isProcessing={isDeleting}
      />
    </HeadlessToastProvider>
  );
};

export default RecordDetailClient;
