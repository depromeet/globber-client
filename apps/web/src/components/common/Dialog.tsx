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
   * 스크린 리더에 전달할 숨김 접근성 설명 문구
   * 생략하면 설명 없음으로 보고 aria-describedby를 비움
   * 화면에 직접 두는 Description이 있으면 null을 넘겨 Radix의 연결을 유지함
   */
  ariaDescription?: string | null;
};

export const DialogContent = ({ className, children, ariaDescription, ...props }: DialogContentProps) => {
  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/40" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl bg-surface-thirdly shadow-lg outline-none",
          "transition-all duration-300",
          "data-[state=open]:scale-100 data-[state=open]:opacity-100",
          "data-[state=closed]:pointer-events-none data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          className
        )}
        // 첫 입력칸에 포커스가 가면 모바일 키보드가 바로 올라오므로, 대신 콘텐츠 자체로 포커스를 옮겨 Tab이 안에서만 돌게 한다
        onOpenAutoFocus={e => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        // 설명이 없으면 Radix가 기본으로 연결하는 aria-describedby를 끄고 개발 경고도 막음 (null은 직접 둔 Description 연결 유지)
        {...(ariaDescription === undefined && { "aria-describedby": undefined })}
        {...props}
      >
        {typeof ariaDescription === "string" && (
          <DialogPrimitive.Description className="sr-only">{ariaDescription}</DialogPrimitive.Description>
        )}
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
