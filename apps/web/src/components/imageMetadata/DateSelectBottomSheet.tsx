"use client";

import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

import { DateSelectFormData, dateSelectSchema, extractDigits, formatYearMonth } from "@globber/shared/schemas/date";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { sendGAEvent } from "@next/third-parties/google";

import { cn } from "@/utils/cn";

import { BaseInputBottomSheet } from "./BaseInputBottomSheet";

type DateSelectBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (date: string) => void;
  photoIndex?: number;
  hasExistingDate?: boolean;
};

export const DateSelectBottomSheet = ({
  isOpen,
  onClose,
  onConfirm,
  photoIndex = 0,
  hasExistingDate = false,
}: DateSelectBottomSheetProps) => {
  const {
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useForm<DateSelectFormData>({
    resolver: standardSchemaResolver(dateSelectSchema),
    defaultValues: {
      date: "",
    },
    mode: "onChange",
  });

  const dateValue = watch("date");
  // 입력 중(YYYY.M까지)에는 안내하지 않고, YYYY.MM을 다 채웠는데 범위를 벗어날 때만 이유를 보여 준다 (GLB-260)
  const isComplete = /^\d{4}\.\d{2}$/.test(dateValue);
  const errorMessage = isComplete ? errors.date?.message : undefined;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = extractDigits(event.target.value);
      const overLimit = digits.length > 6;

      if (!overLimit) {
        const formatted = formatYearMonth(digits);
        setValue("date", formatted, { shouldValidate: true });
        sendGAEvent("event", "record_meta_date_input_change", {
          flow: "editor",
          screen: "record_edit_meta_date",
          click_code: "editor.record.edit.meta.date.input.change",
          photo_index: photoIndex,
          input_length: formatted.length,
          is_valid_format: /^\d{4}\.\d{2}$/.test(formatted),
          over_limit_attempt: false,
        });
      } else {
        sendGAEvent("event", "record_meta_date_input_change", {
          flow: "editor",
          screen: "record_edit_meta_date",
          click_code: "editor.record.edit.meta.date.input.change",
          photo_index: photoIndex,
          input_length: dateValue.length,
          is_valid_format: /^\d{4}\.\d{2}$/.test(dateValue),
          over_limit_attempt: true,
        });
      }
    },
    [setValue, photoIndex, dateValue]
  );

  const onSubmit = useCallback(
    (data: DateSelectFormData) => {
      sendGAEvent("event", "record_meta_date_confirm", {
        flow: "editor",
        screen: "record_edit_meta_date",
        click_code: "editor.record.edit.meta.date.cta.confirm",
        photo_index: photoIndex,
        has_value: true,
      });
      onConfirm?.(data.date);
      onClose();
      reset({ date: "" });
    },
    [onConfirm, onClose, reset, photoIndex]
  );

  const handleClose = useCallback(() => {
    onClose();
    reset({ date: "" });
  }, [onClose, reset]);

  // 바텀시트가 열릴 때 폼 리셋 + view 이벤트
  useEffect(() => {
    if (isOpen) {
      sendGAEvent("event", "record_meta_date_view", {
        flow: "editor",
        screen: "record_edit_meta_date",
        photo_index: photoIndex,
        has_value: hasExistingDate,
      });
      reset({ date: "" });
    }
  }, [isOpen, reset, photoIndex, hasExistingDate]);

  return (
    <BaseInputBottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleSubmit(onSubmit)}
      title="날짜 추가"
      isValid={isValid}
    >
      <input
        type="text"
        value={dateValue}
        onChange={handleInputChange}
        placeholder="YYYY.MM"
        className={cn(
          "w-full bg-[#1B293E] outline-none text-white placeholder-text-thirdly border border-[#243246] focus:border-border-thirdly rounded-2xl px-4 py-3.5 text-base transition-colors",
          errorMessage && "border-state-warning focus:border-state-warning"
        )}
        inputMode="numeric"
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage ? "date-select-error" : undefined}
      />
      {errorMessage && (
        <p id="date-select-error" role="alert" className="mt-2 px-1 text-xs font-medium text-state-warning">
          {errorMessage}
        </p>
      )}
    </BaseInputBottomSheet>
  );
};
