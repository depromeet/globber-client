"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { sendGAEvent } from "@next/third-parties/google";

import { cn } from "@/utils/cn";
import { getAuthInfo } from "@/utils/cookies";

import { Header } from "../common/Header";
import { CityErrorFallback } from "./CityErrorFallback";
import { useDiaryAction } from "./hooks/useDiaryAction";
import { useImageMetadata } from "./hooks/useImageMetadata";
import { ImageUploadSection } from "./ImageUploadSection";
import { LeaveEditConfirmDialog } from "./LeaveEditConfirmDialog";
import { LoadingOverlay } from "./LoadingOverlay";
import { MemoryTextarea } from "./MemoryTextarea";

type ImageMetadataProps = {
  cityId?: number;
  diaryId?: number;
  initialCity?: string;
  initialCountry?: string;
  scrollIndex?: number;
  uuid?: string;
};

export const ImageMetadataComponent = ({
  cityId,
  diaryId,
  initialCity,
  initialCountry,
  scrollIndex,
  uuid,
}: ImageMetadataProps) => {
  const router = useRouter();
  const isCityIdValid = typeof cityId === "number" && Number.isFinite(cityId) && cityId > 0;
  const isEditMode = typeof diaryId === "number" && Number.isFinite(diaryId);

  const {
    metadataList,
    diaryText,
    setDiaryText,
    isProcessing,
    setIsProcessing,
    isInitialLoading,
    fileUploadId,
    handleFileUpload,
    handleRemove,
    handleImageUpdate,
    handleTagChange,
    handleDateChange,
    handleLocationChange,
    handleReorder,
  } = useImageMetadata({ diaryId, isEditMode });

  const hasSavedRef = useRef(false);
  const metadataListRef = useRef(metadataList);
  const diaryTextRef = useRef(diaryText);

  useEffect(() => {
    metadataListRef.current = metadataList;
  }, [metadataList]);

  useEffect(() => {
    diaryTextRef.current = diaryText;
  }, [diaryText]);

  const { handleSave, saveStartedRef, saveCompletedRef, savePhotoCountRef, saveTextLengthRef } = useDiaryAction({
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
  });

  useEffect(() => {
    sendGAEvent("event", "editor_record_edit_view", {
      flow: "editor",
      screen: "record_edit",
    });
    return () => {
      // 언마운트 시점의 최신 ref 값을 GA 이벤트에 사용하기 위한 의도적인 패턴
      /* eslint-disable react-hooks/exhaustive-deps */
      const hasSaved = hasSavedRef.current;
      const photoCount = metadataListRef.current.length;
      const textLength = diaryTextRef.current.length;
      const saveStarted = saveStartedRef.current;
      const saveCompleted = saveCompletedRef.current;
      const savePhotoCount = savePhotoCountRef.current;
      const saveTextLength = saveTextLengthRef.current;
      /* eslint-enable react-hooks/exhaustive-deps */

      sendGAEvent("event", "editor_record_edit_exit", {
        flow: "editor",
        screen: "record_edit",
        has_saved: hasSaved,
        photo_count: photoCount,
        text_length: textLength,
      });
      if (saveStarted && !saveCompleted) {
        sendGAEvent("event", "record_save_exit", {
          flow: "editor",
          screen: "record_save",
          photo_count: savePhotoCount,
          text_length: saveTextLength,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 사용자가 사진·글·메타데이터를 한 번이라도 바꿨는지. 편집 모드에서 기존 기록을 불러오는 것은 변경으로 보지 않는다 (GLB-134)
  const [isDirty, setIsDirty] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  // 확인 창에서 나가기를 고른 뒤에는 브라우저 기본 경고가 한 번 더 뜨지 않게 한다
  const allowLeaveRef = useRef(false);

  // 핸들러의 반환값(비동기 업로드의 Promise 등)을 그대로 돌려줘야 호출부가 완료를 기다릴 수 있다
  const withDirty =
    <Args extends unknown[], Result>(handler: (...args: Args) => Result) =>
    (...args: Args): Result => {
      setIsDirty(true);
      return handler(...args);
    };

  // 새로고침·탭 닫기·외부 이동은 브라우저 기본 경고만 띄울 수 있다(문구는 브라우저가 정함)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeaveRef.current || hasSavedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const leave = () => {
    allowLeaveRef.current = true;
    // history.length에는 앞으로 가기 항목도 포함되므로 실제 뒤로 갈 수 있는지를 확인한다
    const navigation = (window as Window & { navigation?: { canGoBack: boolean } }).navigation;
    if (navigation?.canGoBack) {
      router.back();
      return;
    }

    if (!isEditMode || !isCityIdValid) {
      router.replace("/record");
      return;
    }

    const finalUuid = uuid || getAuthInfo().uuid;
    if (!finalUuid) {
      router.replace("/login");
      return;
    }

    const params = new URLSearchParams({ uuid: finalUuid });
    if (typeof scrollIndex === "number") {
      params.set("scrollIndex", String(scrollIndex));
    }
    // Navigation API가 없는 브라우저도 수정하던 기록으로 확실히 돌아가도록 한다
    router.replace(`/record/${cityId}?${params.toString()}`);
  };

  const handleBack = () => {
    // 저장에 성공해 이동하는 중이 아니면 확인한다(저장에 실패한 뒤에도 변경 내용은 남아 있으므로 확인한다)
    if (isDirty && !hasSavedRef.current) {
      setIsLeaveDialogOpen(true);
      return;
    }
    leave();
  };

  const handleConfirmLeave = () => {
    setIsLeaveDialogOpen(false);
    leave();
  };

  const handleRemoveWithGA = (id: string) => {
    sendGAEvent("event", "record_photo_delete_confirm", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.photo.delete.confirm",
      photo_count: metadataList.length - 1,
    });
    setIsDirty(true);
    handleRemove(id);
  };

  const handleSaveClick = () => {
    const hasMetadata = metadataList.some(item => item.customDate || item.location?.address);
    sendGAEvent("event", "record_edit_save_click", {
      flow: "editor",
      screen: "record_edit",
      click_code: "editor.record.edit.header.save",
      photo_count: metadataList.length,
      text_length: diaryText.length,
      has_metadata: hasMetadata,
    });
    handleSave();
  };

  const handleNavigateToCitySelection = () => {
    router.push("/record");
  };

  if (!isCityIdValid) {
    return <CityErrorFallback onBack={handleBack} onNavigateToCitySelection={handleNavigateToCitySelection} />;
  }

  const locationTitle = [initialCity, initialCountry].filter(Boolean).join(", ");
  const headerTitle = locationTitle || "나라, 도시 이름";
  const hasImages = metadataList.length > 0;
  const isBusy = isProcessing || isInitialLoading;

  return (
    <div className="max-w-md mx-auto min-h-dvh bg-black text-white" aria-busy={isBusy}>
      <LoadingOverlay show={isBusy} />
      <div inert={isBusy}>
        <Header
          title={headerTitle}
          variant="dark"
          leftIcon="back"
          onLeftClick={handleBack}
          rightButtonTitle="저장"
          rightButtonDisabled={!hasImages || isProcessing || isInitialLoading || !isCityIdValid}
          onRightClick={handleSaveClick}
          // 로딩 오버레이(z-50)가 헤더를 덮어 뒤로가기·저장 버튼이 눌리지 않게 한다
          className={cn("sticky top-0", isBusy ? "z-40" : "z-50")}
        />
        <ImageUploadSection
          metadataList={metadataList}
          fileUploadId={fileUploadId}
          handleRemove={handleRemoveWithGA}
          handleImageUpdate={withDirty(handleImageUpdate)}
          handleTagChange={withDirty(handleTagChange)}
          handleDateChange={withDirty(handleDateChange)}
          handleLocationChange={withDirty(handleLocationChange)}
          handleReorder={withDirty(handleReorder)}
        />

        <input
          type="file"
          multiple
          accept="image/*,image/heic"
          onChange={event => {
            // 파일 선택 창을 그냥 닫은 경우는 변경으로 보지 않는다
            if (event.target.files?.length) setIsDirty(true);
            handleFileUpload(event);
          }}
          className="hidden"
          id={fileUploadId}
        />
        <div className="px-4">
          <MemoryTextarea value={diaryText} onChange={withDirty(setDiaryText)} />
        </div>
      </div>
      <LeaveEditConfirmDialog
        isOpen={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        onLeave={handleConfirmLeave}
      />
    </div>
  );
};
