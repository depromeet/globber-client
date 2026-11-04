"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/utils/cn";

export const Dialog = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};

export const DialogTrigger = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};

export const DialogPortal = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};

export const DialogClose = ({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};

export const DialogOverlay = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) => {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        className
      )}
      {...props}
    />
  );
};

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * Accessible description for screen readers when no visible DialogDescription is provided.
   * This text is visually hidden but announced to assistive technologies.
   * @default "Dialog content"
   */
  ariaDescription?: string;
};

export const DialogContent = ({
  className,
  children,
  ariaDescription = "Dialog content",
  ...props
}: DialogContentProps) => {
  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/40" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl bg-surface-thirdly shadow-lg",
          "transition-all duration-300",
          "data-[state=open]:scale-100 data-[state=open]:opacity-100",
          "data-[state=closed]:pointer-events-none data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          className
        )}
        onOpenAutoFocus={e => e.preventDefault()}
        {...props}
      >
        <DialogPrimitive.Description className="sr-only">{ariaDescription}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

export const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2.5 text-center", className)} {...props} />;
};

export const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-bold text-text-primary", className)}
      {...props}
    />
  );
};

export const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  );
};

export const DialogBody = ({ className, ...props }: React.ComponentProps<"div">) => {
  return <div data-slot="dialog-body" className={cn("flex flex-col gap-5 px-5 py-7.5", className)} {...props} />;
};

export const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
  return <div data-slot="dialog-footer" className={cn("flex flex-col gap-2.5 px-5 pb-5", className)} {...props} />;
};

export const DialogActions = ({ className, ...props }: React.ComponentProps<"div">) => {
  return <div data-slot="dialog-actions" className={cn("flex gap-2.5 items-center", className)} {...props} />;
};
