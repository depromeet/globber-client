"use client";

import { useState } from "react";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/utils/cn";

type DropdownVariant = "dark" | "light";

export const VARIANT_STYLES = {
  dark: {
    content: "bg-[#1c2d45] border-[rgba(255,255,255,0.1)]",
    item: {
      base: "text-white",
      checked: "text-[#00d9ff]",
      hover: "hover:bg-[rgba(255,255,255,0.05)]",
    },
    separator: "bg-[rgba(255,255,255,0.1)]",
  },
  light: {
    content: "bg-white border-border-primary",
    item: {
      base: "text-text-inverseprimary",
      checked: "text-text-inverseprimary",
      hover: "hover:bg-[rgba(0,0,0,0.04)]",
    },
    separator: "bg-border-primary",
  },
} as const;

type DropdownProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  options: Array<{
    label: string;
    value: string;
    onClick?: () => void;
  }>;
  placeholder?: string;
  className?: string;
  variant?: DropdownVariant;
  showCheckIcon?: boolean;
  trigger?: React.ReactNode;
  asMenu?: boolean;
};

export const Dropdown = ({
  value,
  onValueChange,
  onOpenChange,
  options,
  placeholder = "선택해주세요",
  className,
  variant = "dark",
  showCheckIcon = true,
  trigger,
  asMenu = false,
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const handleItemClick = (option: { value: string; onClick?: () => void }) => {
    if (asMenu) {
      option.onClick?.();
      setIsOpen(false);
    } else {
      onValueChange?.(option.value);
    }
  };

  const styles = VARIANT_STYLES[variant];

  if (asMenu) {
    return (
      <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuPrimitive.Trigger asChild className={className}>
          {trigger}
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            className={cn(
              "relative z-50 min-w-[111px]",
              styles.content,
              "border border-solid",
              "rounded-lg shadow-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            )}
            side="bottom"
            align="end"
            sideOffset={8}
            onCloseAutoFocus={e => e.preventDefault()}
          >
            {options.map((option, index) => (
              <div key={option.value}>
                <DropdownMenuPrimitive.Item
                  onSelect={() => {
                    handleItemClick(option);
                  }}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center gap-2",
                    "px-5 py-3",
                    "text-[16px] font-medium leading-[1.3] tracking-[-0.32px]",
                    "outline-none transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                    "focus-visible:ring-[--color-surface-inverseprimary]",
                    index === 0 && "rounded-t-lg",
                    index === options.length - 1 && "rounded-b-lg",
                    styles.item.base,
                    styles.item.hover
                  )}
                >
                  <span className="shrink-0">{option.label}</span>
                </DropdownMenuPrimitive.Item>
                {index < options.length - 1 && <div className={cn("h-px", styles.separator)} />}
              </div>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );
  }

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} open={isOpen} onOpenChange={handleOpenChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex items-center gap-1 text-white text-base font-medium hover:opacity-80 transition-opacity cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "focus-visible:ring-(--color-surface-inverseprimary)",
          className
        )}
        aria-label={`정렬 선택: 현재 ${value}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "relative z-50 min-w-[102px]",
            styles.content,
            "border border-solid",
            "rounded-lg shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          position="popper"
          side="bottom"
          align="end"
          sideOffset={8}
        >
          <SelectPrimitive.Viewport className="p-0">
            {options.map((option, index) => (
              <div key={option.value}>
                <SelectPrimitive.Item
                  value={option.value}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center gap-2",
                    "py-2 px-3",
                    "text-sm font-medium",
                    "outline-none transition-colors",
                    index === 0 && "rounded-t-lg",
                    index === options.length - 1 && "rounded-b-lg",
                    styles.item.base,
                    styles.item.hover,
                    value === option.value && styles.item.checked
                  )}
                >
                  {showCheckIcon && (
                    <Check className={cn("w-4 h-4 shrink-0", value === option.value ? "visible" : "invisible")} />
                  )}
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                {index < options.length - 1 && <div className={cn("h-px", styles.separator)} />}
              </div>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
