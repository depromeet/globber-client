"use client";

import type { ReactNode } from "react";

type SettingSectionProps = {
  title: string;
  children: ReactNode;
};

export const SettingSection = ({ title, children }: SettingSectionProps) => {
  return (
    <div className="border-t border-surface-placeholder--4 flex flex-col gap-4 w-full pt-5">
      <p className="font-bold text-xl text-text-primary">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
};
