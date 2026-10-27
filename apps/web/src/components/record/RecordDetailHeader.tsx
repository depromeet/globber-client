"use client";

import { useMemo } from "react";

import { DotIcon } from "@/assets/icons";
import { Dropdown } from "@/components/common/Dropdown";
import { Header } from "@/components/common/Header";

type RecordDetailHeaderProps = {
  city: string;
  country: string;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
};

export const RecordDetailHeader = ({
  city,
  country,
  onBack,
  onEdit,
  onDelete,
  isOwner = false,
}: RecordDetailHeaderProps) => {
  const menuOptions = useMemo(() => {
    const options = [];

    if (onEdit) {
      options.push({
        label: "기록 편집",
        value: "edit",
        onClick: onEdit,
      });
    }

    if (onDelete) {
      options.push({
        label: "기록 삭제",
        value: "delete",
        onClick: onDelete,
      });
    }

    return options;
  }, [onEdit, onDelete]);

  const title = `${city}, ${country}`;
  const truncatedTitle = title.length > 20 ? `${title.slice(0, 20)}...` : title;

  return (
    <div className="relative">
      <Header
        variant="transparent"
        leftIcon="close"
        onLeftClick={onBack}
        title={truncatedTitle}
        rightIcon={
          isOwner ? (
            <Dropdown
              asMenu
              variant="light"
              options={menuOptions}
              value=""
              trigger={
                <button
                  type="button"
                  className="flex items-center justify-center w-11 h-11 cursor-pointer hover:opacity-70 transition-opacity"
                  aria-label="메뉴 열기"
                >
                  <DotIcon />
                </button>
              }
            />
          ) : undefined
        }
      />
    </div>
  );
};
