"use client";

import type React from "react";

import { CalendarIcon, CloseIcon, MapPinIcon } from "@/assets/icons";

interface MetadataChipProps {
  iconType?: "calendar" | "location" | "custom";
  icon?: React.ReactNode;
  text: string;
  onRemove?: () => void;
  onClick?: () => void;
  isPlaceholder?: boolean;
}

export const MetadataChip = ({
  iconType = "custom",
  icon,
  text,
  onRemove,
  onClick,
  isPlaceholder = false,
}: MetadataChipProps) => {
  const renderIcon = () => {
    if (iconType === "calendar") {
      return <CalendarIcon width={16} height={16} />;
    }
    if (iconType === "location") {
      return <MapPinIcon width={16} height={16} />;
    }
    if (icon) {
      return icon;
    }
    return null;
  };

  const handleRemoveChip = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove?.();
  };

  const baseClasses = "inline-flex items-center gap-2 bg-[#000000]/40 pl-2 pr-2.5 py-1.5 rounded-lg";
  const textClasses = isPlaceholder ? "text-[#FFFFFF80]" : "text-white";

  if (onClick && onRemove) {
    return (
      <div className={`${baseClasses} relative`}>
        <button
          onClick={onClick}
          className="flex items-center gap-2 -m-1.5 pl-1.5 pr-7 py-1.5 cursor-pointer"
          type="button"
        >
          {/* Left Icon */}
          <div className="flex-shrink-0">{renderIcon()}</div>

          {/* Center Text */}
          <span className={`text-sm font-medium truncate max-w-[170px] ${textClasses}`}>{text}</span>
        </button>

        {/* Right X Icon */}
        <button
          onClick={handleRemoveChip}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex-shrink-0"
          aria-label="Remove MetadataChip"
          type="button"
        >
          <CloseIcon width={8} height={8} className="text-[#A8B8C6]" />
        </button>
      </div>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={`${baseClasses} cursor-pointer`} type="button">
        {/* Left Icon */}
        <div className="flex-shrink-0">{renderIcon()}</div>

        {/* Center Text */}
        <span className={`text-sm font-medium truncate max-w-[170px] ${textClasses}`}>{text}</span>
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {/* Left Icon */}
      <div className="flex-shrink-0">{renderIcon()}</div>

      {/* Center Text */}
      <span className={`text-sm font-medium truncate max-w-[220px] ${textClasses}`}>{text}</span>

      {/* Right X Icon */}
      {onRemove && (
        <button
          onClick={handleRemoveChip}
          className="flex-shrink-0 ml-auto"
          aria-label="Remove MetadataChip"
          type="button"
        >
          <CloseIcon width={8} height={8} className="text-[#A8B8C6]" />
        </button>
      )}
    </div>
  );
};
