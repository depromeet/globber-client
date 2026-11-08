"use client";

import { useState } from "react";

import { IMAGE_TAGS, type ImageTag, TAG_LABELS } from "@globber/shared/types/imageMetadata";

import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

type TagSelectorProps = {
  selectedTag?: ImageTag | null;
  onSelect: (tag: ImageTag) => void;
  onRemove?: () => void;
  placeholder?: string;
  className?: string;
};

export const TagSelector = ({
  selectedTag,
  onSelect,
  onRemove,
  placeholder = "태그 지정",
  className,
}: TagSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (tag: ImageTag) => {
    onSelect(tag);
    setIsOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <div className={cn("relative inline-block w-fit", className)}>
      {selectedTag ? (
        // 태그가 선택된 상태에서는 칩 자체가 아무 동작도 하지 않으므로 삭제만 별도 버튼으로 둠 (버튼 안에 버튼을 넣지 않기 위함)
        <div className="flex items-center gap-2 bg-surface-secondary border border-[#243246] px-3 py-2 text-xs font-medium text-white rounded-lg w-[63px]">
          <span>{TAG_LABELS[selectedTag]}</span>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`${TAG_LABELS[selectedTag]} 태그 삭제`}
            className="-m-2 p-2 cursor-pointer text-surface-inversethirdly"
          >
            <CloseIcon width={8} height={8} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 bg-surface-secondary border border-[#243246] px-3 py-2 text-xs font-medium text-white cursor-pointer",
            isOpen ? "rounded-t-lg border-b-0" : "rounded-lg"
          )}
          type="button"
        >
          <span>{placeholder}</span>
          {isOpen ? <ChevronUpIcon width={12} height={12} /> : <ChevronDownIcon width={12} height={12} />}
        </button>
      )}

      {isOpen && !selectedTag && (
        <div className="absolute left-0 top-full z-50 w-full mt-[-1px]">
          <div className="bg-[#112036] border border-[#243246] rounded-b-lg overflow-hidden">
            {IMAGE_TAGS.map((tag, index) => (
              <button
                type="button"
                key={tag}
                onClick={() => handleSelect(tag)}
                className={cn(
                  "w-full px-3 py-2 text-left text-xs font-medium text-white cursor-pointer",
                  index !== IMAGE_TAGS.length - 1 && "border-b border-[#243246]"
                )}
              >
                {TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
