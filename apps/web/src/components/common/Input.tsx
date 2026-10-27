import { useState } from "react";

import { cva, type VariantProps } from "class-variance-authority";
import { Upload } from "lucide-react";

import { SearchbarActiveIcon, SearchbarInactiveIcon, SearchCloseIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

const inputVariants = cva(
  "flex w-full items-center justify-center rounded-3xl p-3 text-sm outline-none placeholder:text-gray-400 focus:outline-primary-600 focus:shadow-primary focus:outline-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 h-12",
  {
    variants: {
      isDark: {
        true: "bg-gray-700 text-white outline-gray-500",
        false: "bg-white text-gray-900 outline-gray-200",
      },
    },
    defaultVariants: {
      isDark: false,
    },
  }
);

const iconStyles = "absolute top-1/2 left-3 -translate-y-1/2 text-gray-500";

export const Input = ({
  className,
  type,
  isDark,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants> & { variant?: "success" | "fail" }) => {
  return (
    <div className={cn("relative", className)}>
      <input type={type} data-slot="input" className={cn(inputVariants({ isDark }), className)} {...props} />
    </div>
  );
};

type SearchInputProps = React.ComponentProps<"input"> & {
  backgroundColor?: string;
};

export const SearchInput = ({ className, value, onChange, backgroundColor, ...props }: SearchInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onChange) {
      const event = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  const hasValue = typeof value === "string" && value.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "border border-surface-placeholder--4 rounded-2xl px-4 py-3.5 flex items-center gap-3",
          !backgroundColor && "bg-surface-thirdly"
        )}
        style={{ backgroundColor: backgroundColor || undefined }}
      >
        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
          {isFocused || hasValue ? (
            <SearchbarActiveIcon className="w-6 h-6" />
          ) : (
            <SearchbarInactiveIcon className="w-6 h-6" />
          )}
        </div>
        <input
          type="text"
          className="flex-1 bg-transparent text-text-primary placeholder-text-thirdly text-base font-medium leading-6 outline-none min-w-0"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChange={onChange}
          {...props}
        />
        {hasValue && (
          <div className="w-6 h-6 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handleClear}
              className="w-full h-full flex items-center justify-center"
              aria-label="검색어 지우기"
            >
              <SearchCloseIcon className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ImageUploadInput = ({ className, ...props }: React.ComponentProps<"input">) => {
  return (
    <div className={cn("relative", className)}>
      <input type="file" data-slot="image-upload-input" className={cn(inputVariants(), "pl-10 pr-3")} {...props} />
      <div className={iconStyles} style={{ width: 24, height: 24 }}>
        <Upload size={24} />
      </div>
    </div>
  );
};
