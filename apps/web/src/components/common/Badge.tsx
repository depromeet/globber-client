import type * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/cn";

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-8 py-4 text-xs font-medium text-center leading-[100%]",
  {
    variants: {
      variant: {
        primary: "bg-primary-100 text-primary-600",
        gray: "bg-gray-100 text-gray-600",
      },
      size: {
        xs: "px-8 py-4 text-xs",
        sm: "px-10 py-6 text-sm",
        md: "px-12 py-8 text-md",
        lg: "px-14 py-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "gray",
    },
  }
);

export const Badge = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) => {
  const Comp = asChild ? Slot : "span";

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
};
