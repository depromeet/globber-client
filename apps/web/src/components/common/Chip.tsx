import type * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

export const chipVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium outline-none transition-colors",
  {
    variants: {
      variant: {
        gray: "bg-[#243246] text-white",
      },
      size: {
        sm: "px-8 py-4 text-xs",
        md: "pl-3 pr-2 py-2 text-sm",
        lg: "px-12 py-8 text-base",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "md",
    },
  }
);

export type ChipProps = React.ComponentProps<"div"> &
  VariantProps<typeof chipVariants> & {
    asChild?: boolean;
    onRemove?: () => void;
    removable?: boolean;
    icon?: React.ReactNode;
  };

export const Chip = ({
  className,
  variant,
  size,
  asChild = false,
  onRemove,
  removable = false,
  icon,
  children,
  ...props
}: ChipProps) => {
  const Comp = asChild ? Slot : "div";

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (removable && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      onRemove?.();
    }
  };

  return (
    <Comp
      data-slot="chip"
      className={cn(chipVariants({ variant, size }), className)}
      onKeyDown={handleKeyDown}
      tabIndex={removable ? 0 : undefined}
      role={removable ? "button" : undefined}
      aria-label={removable ? `${children} 칩, 삭제하려면 Delete 키를 누르세요` : undefined}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          className="flex-shrink-0 rounded-full hover:bg-black/10 focus:bg-black/10 transition-colors p-1.5 -mr-1 flex items-center justify-center"
          aria-label="칩 삭제"
        >
          <CloseIcon width={8} height={8} />
        </button>
      )}
    </Comp>
  );
};
