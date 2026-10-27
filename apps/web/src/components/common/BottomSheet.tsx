"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/utils/cn";

export const BottomSheet = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  return <DialogPrimitive.Root data-slot="bottom-sheet" {...props} />;
};

export const BottomSheetTrigger = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) => {
  return <DialogPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />;
};

export const BottomSheetPortal = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) => {
  return <DialogPrimitive.Portal data-slot="bottom-sheet-portal" {...props} />;
};

export const BottomSheetClose = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) => {
  return <DialogPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
};

export const BottomSheetOverlay = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) => {
  return (
    <DialogPrimitive.Overlay
      data-slot="bottom-sheet-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        className
      )}
      {...props}
    />
  );
};

export const BottomSheetContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) => {
  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <DialogPrimitive.Content
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full",
          "bg-surface-thirdly rounded-t-[30px]",
          "px-4 py-5 flex flex-col",
          "transition-all duration-300",
          "data-[state=open]:slide-in-from-bottom-0 data-[state=open]:animate-in",
          "data-[state=closed]:slide-out-to-bottom-0 data-[state=closed]:animate-out",
          className
        )}
        onOpenAutoFocus={e => e.preventDefault()}
        {...props}
      >
        <DialogPrimitive.Description className="sr-only">description</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </BottomSheetPortal>
  );
};

export const BottomSheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn("relative h-11 flex items-center justify-center shrink-0", className)}
      {...props}
    />
  );
};

export const BottomSheetTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => {
  return (
    <DialogPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn("text-lg font-bold text-text-primary", className)}
      {...props}
    />
  );
};

export const BottomSheetCloseButton = ({ className, ...props }: React.ComponentProps<"button">) => {
  return (
    <button
      type="button"
      aria-label="닫기"
      data-slot="bottom-sheet-close-button"
      className={cn(
        "absolute left-4 top-1/2 -translate-y-1/2",
        "flex items-center justify-center w-8 h-8",
        "text-text-primary hover:bg-surface-placeholder--8 rounded-full",
        "transition-colors",
        className
      )}
      {...props}
    />
  );
};

export const BottomSheetBody = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn("flex flex-col gap-10 py-10 overflow-y-auto", className)}
      {...props}
    />
  );
};
