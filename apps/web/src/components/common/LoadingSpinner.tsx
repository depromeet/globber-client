"use client";

import { LoadingIcon } from "@/assets/icons";

export function LoadingSpinner() {
  return (
    <div className="relative flex items-center justify-center">
      <LoadingIcon className="w-full h-full animate-spin" />
    </div>
  );
}
