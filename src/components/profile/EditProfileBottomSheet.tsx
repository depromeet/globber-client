"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Image from "next/image";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { sendGAEvent } from "@next/third-parties/google";
import { X } from "lucide-react";

import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetCloseButton,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { DEFAULT_PROFILE_IMAGE } from "@/constants/image";
import { useImageLoadError } from "@/hooks/useImageLoadError";
import {
  containsEmoji,
  createEditProfileSchema,
  EditProfileFormData,
  PROFILE_VALIDATION,
  removeEmoji,
  validateImageFile,
} from "@/schemas/profile";
import { cn } from "@/utils/cn";

type EditProfileBottomSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialImage?: string;
  onSave: (name: string, imageFile?: File) => void | Promise<void>;
};

export const EditProfileBottomSheet = ({
  isOpen,
  onOpenChange,
  initialName = "",
  initialImage,
  onSave,
}: EditProfileBottomSheetProps) => {
  const nicknameId = useId();

  // 사용자가 새로 선택한 이미지의 프리뷰 URL (선택하지 않았으면 null)
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const prevIsOpenRef = useRef(isOpen);

  // 기존 닉네임(이모지 포함 가능)은 변경하지 않은 경우 이모지 검증에서 제외
  const profileSchema = useMemo(() => createEditProfileSchema(initialName), [initialName]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditProfileFormData>({
    resolver: standardSchemaResolver(profileSchema),
    defaultValues: {
      nickname: initialName,
      imageFile: undefined,
    },
    mode: "onChange",
  });

  // 바텀시트가 열릴 때 폼 리셋
  // Note: 바텀시트가 열릴 때마다 깨끗한 상태로 초기화하는 것이 명확한 요구사항입니다.
  // prop 변경에 반응하는 effect 패턴을 의도적으로 사용합니다.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      reset({
        nickname: initialName,
        imageFile: undefined,
      });
      setSelectedImagePreview(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialName, reset]);

  const nickname = watch("nickname");
  const imageFile = watch("imageFile");
  const hasChanges = isDirty || imageFile !== undefined;

  // 표시할 이미지를 렌더링 시 직접 계산
  const normalizedInitialImage = initialImage?.trim();
  const displayImage = selectedImagePreview || normalizedInitialImage || DEFAULT_PROFILE_IMAGE;
  const { hasError: hasImageError, handleError: handleImageError } = useImageLoadError(displayImage);

  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const originalFile = e.target.files?.[0];
      if (!originalFile) return;

      let file = originalFile;

      // HEIC 파일 감지 및 변환
      const isHeic =
        originalFile.type === "image/heic" ||
        originalFile.type === "image/heif" ||
        originalFile.name.toLowerCase().endsWith(".heic") ||
        originalFile.name.toLowerCase().endsWith(".heif");

      if (isHeic) {
        try {
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({
            blob: originalFile,
            toType: "image/jpeg",
            quality: 0.9,
          });

          // heic2any는 Blob 또는 Blob[]을 반환할 수 있음
          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

          // Blob을 File 객체로 변환
          const fileName = originalFile.name.replace(/\.(heic|heif)$/i, ".jpg");
          file = new File([blob], fileName, { type: "image/jpeg" });
        } catch (error) {
          console.error("HEIC 변환 실패:", error);
          alert("HEIC 이미지를 변환하는데 실패했습니다. 다른 이미지를 선택해주세요.");
          e.target.value = "";
          return;
        }
      }

      const validation = validateImageFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        e.target.value = "";

        return;
      }

      // React Hook Form에 파일 설정
      setValue("imageFile", file, { shouldDirty: true, shouldValidate: true });

      // 로컬 프리뷰 표시
      const input = e.target;
      const reader = new FileReader();

      reader.onerror = () => {
        alert("이미지를 불러오는데 실패했습니다.");
        setValue("imageFile", undefined, { shouldDirty: true, shouldValidate: true });
        setSelectedImagePreview(null);
        input.value = "";
      };
      reader.onload = event => {
        const result = event.target?.result as string;
        setSelectedImagePreview(result);
      };

      reader.readAsDataURL(file);
    },
    [setValue]
  );

  const onSubmit = useCallback(
    async (data: EditProfileFormData) => {
      sendGAEvent("event", "menu_profile_edit_save_click", {
        flow: "menu",
        screen: "profile_edit",
        click_code: "menu.profile.edit.header.save",
      });
      try {
        setIsLoading(true);
        await onSave(data.nickname, data.imageFile);
        onOpenChange(false);
      } catch (error) {
        console.error("프로필 저장 실패:", error);
        alert("프로필 저장에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setIsLoading(false);
      }
    },
    [onSave, onOpenChange]
  );

  return (
    <BottomSheet open={isOpen} onOpenChange={onOpenChange}>
      <BottomSheetContent className="h-[calc(100dvh-62px)] max-w-lg">
        <BottomSheetHeader className="w-full h-11 relative">
          <BottomSheetCloseButton
            onClick={() => {
              sendGAEvent("event", "menu_profile_edit_close_click", {
                flow: "menu",
                screen: "profile_edit",
                click_code: "menu.profile.edit.header.close",
              });
              onOpenChange(false);
            }}
            aria-label="닫기"
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6"
          >
            <X size={24} />
          </BottomSheetCloseButton>

          <BottomSheetTitle className="text-lg font-bold text-white text-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            프로필 편집
          </BottomSheetTitle>

          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading || !hasChanges || !nickname || nickname.length === 0}
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2",
              "bg-transparent text-base font-bold px-2 py-1.5",
              isLoading || !hasChanges || !nickname || nickname.length === 0 ? "text-text-thirdly" : "text-blue-theme"
            )}
            variant="primary"
          >
            저장
          </Button>
        </BottomSheetHeader>

        <BottomSheetBody className="items-center px-0!">
          {/* 프로필 이미지 섹션 */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden bg-surface-placeholder--16">
              <Image
                src={hasImageError ? DEFAULT_PROFILE_IMAGE : displayImage}
                alt="프로필 이미지"
                fill
                className="object-cover"
                onError={handleImageError}
              />
            </div>

            <label
              className={cn(
                "text-xs font-medium underline transition-colors",
                isLoading
                  ? "text-text-thirdly cursor-not-allowed"
                  : "text-text-secondary cursor-pointer hover:text-text-primary"
              )}
              onClick={() => {
                if (isLoading) return;

                sendGAEvent("event", "menu_profile_edit_photo_change_click", {
                  flow: "menu",
                  screen: "profile_edit",
                  click_code: "menu.profile.edit.photo.change",
                });
              }}
            >
              {isLoading ? "저장 중..." : "이미지 변경"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isLoading}
                className="hidden"
              />
            </label>
          </div>

          {/* 닉네임 입력 섹션 */}
          <div className="flex flex-col gap-2.5 w-full px-4">
            <label htmlFor={nicknameId} className="text-sm font-medium text-white">
              닉네임
            </label>
            <div className="relative w-full">
              <input
                id={nicknameId}
                type="text"
                {...register("nickname")}
                maxLength={PROFILE_VALIDATION.MAX_NICKNAME_LENGTH}
                placeholder="닉네임을 입력하세요"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onInput={e => {
                  const { value } = e.currentTarget;
                  if (containsEmoji(value)) {
                    setValue("nickname", removeEmoji(value), { shouldValidate: true, shouldDirty: true });
                  }
                }}
                className={cn(
                  "w-full h-[50px] px-4 py-3.5",
                  "rounded-2xl border",
                  errors.nickname ? "border-red-500" : "border-[rgba(255,255,255,0.04)]",
                  "bg-linear-to-b from-[rgba(255,255,255,0.04)] to-[rgba(255,255,255,0.04)] bg-surface-thirdly",
                  "text-base font-medium text-white",
                  "placeholder:text-text-thirdly",
                  "outline-none focus:border-blue-theme transition-colors"
                )}
                style={{
                  backgroundImage:
                    "linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.04) 100%), linear-gradient(0deg, #112036 0%, #112036 100%)",
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <span
                  className={cn(
                    "text-xs font-medium transition-colors",
                    (nickname?.length ?? 0) === PROFILE_VALIDATION.MAX_NICKNAME_LENGTH
                      ? "text-white"
                      : "text-text-thirdly"
                  )}
                >
                  {nickname?.length ?? 0} / {PROFILE_VALIDATION.MAX_NICKNAME_LENGTH}
                </span>
              </div>
            </div>
            {/* 에러 메시지 */}
            {errors.nickname && <span className="text-xs text-red-500 mt-1">{errors.nickname.message}</span>}
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
};
