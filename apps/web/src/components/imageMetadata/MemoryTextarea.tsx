import { useRef } from "react";

import { sendGAEvent } from "@next/third-parties/google";

import { toast } from "@/components/common/GlobalToast";

type MemoryTextareaProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

const MAX_LENGTH = 200;
const TOAST_DURATION = 1500;
const TOAST_COOLDOWN = 1500;
const TEXT_MILESTONES = [50, 100, 150, 200];

export const MemoryTextarea = ({
  value,
  onChange,
  placeholder = "여행 도시에 대한 추억을 남겨주세요...",
  rows = 13,
}: MemoryTextareaProps) => {
  const lastToastTimeRef = useRef<number>(0);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = () => {
    const now = Date.now();
    const timeSinceLastToast = now - lastToastTimeRef.current;

    // 1.5초 이내에 연속 초과 입력이 감지되면 토스트 재노출하지 않음
    if (timeSinceLastToast < TOAST_COOLDOWN) {
      return;
    }

    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    toast.error(`최대 ${MAX_LENGTH}자까지만 입력이 가능합니다.`, { variant: "editor", duration: TOAST_DURATION });
    lastToastTimeRef.current = now;

    cooldownTimeoutRef.current = setTimeout(() => {
      cooldownTimeoutRef.current = null;
    }, TOAST_COOLDOWN);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const prevLength = value?.length ?? 0;
    if (newValue.length <= MAX_LENGTH) {
      onChange?.(newValue);
      for (const milestone of TEXT_MILESTONES) {
        if (prevLength < milestone && newValue.length >= milestone) {
          sendGAEvent("event", "record_text_progress", {
            flow: "editor",
            screen: "record_edit",
            text_length: milestone,
          });
        }
      }
    } else {
      showToast();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pastedText = e.clipboardData.getData("text");
    const currentValue = value || "";
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedLength = selectionEnd - selectionStart;

    // 선택된 영역을 제외하고 붙여넣을 텍스트를 더한 실제 결과 길이 계산
    const actualResultLength = currentValue.length - selectedLength + pastedText.length;

    if (actualResultLength > MAX_LENGTH) {
      e.preventDefault();
      showToast();
    }
  };

  return (
    <div className="w-full px-2 mt-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label="여행 기록 내용"
        className="w-full bg-transparent text-text-primary text-base leading-5 placeholder:text-text-secondary/60 resize-none outline-none"
        rows={rows}
      />
    </div>
  );
};
