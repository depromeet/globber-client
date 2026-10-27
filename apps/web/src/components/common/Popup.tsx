import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/cn";

export const popupVariants = cva("relative z-50 flex flex-col rounded-lg transition-all duration-300 transform-gpu", {
  variants: {
    variant: {
      default: "bg-white text-gray-800",
      card: "bg-gray-100 text-gray-800",
    },
    size: {
      sm: "w-80 p-6",
      md: "w-96 p-8",
      lg: "w-[42rem] p-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export const Popup = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof popupVariants> & {
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot : "div";

  return <Comp data-slot="popup" className={cn(popupVariants({ variant, size, className }))} {...props} />;
};
