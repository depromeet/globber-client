"use client";

import { ChevronRight } from "lucide-react";

type SettingItemProps = {
  label: string;
  onClick?: () => void;
  className?: string;
  href?: string;
};

export const SettingItem = ({ label, onClick, className, href }: SettingItemProps) => {
  const commonClasses = `flex items-center justify-between w-full p-0 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity ${
    className || ""
  }`;

  const content = (
    <>
      <p className="font-medium text-base text-[rgba(255,255,255,0.60)]">{label}</p>
      <ChevronRight className="size-5 text-[rgba(255,255,255,0.60)] shrink-0" />
    </>
  );

  if (href) {
    const isExternal = href.startsWith("http");
    const isMailto = href.startsWith("mailto:");
    return (
      <a
        href={href}
        className={commonClasses}
        style={{ textDecoration: "none" }}
        target={isExternal || isMailto ? "_blank" : undefined}
        rel={isExternal || isMailto ? "noopener noreferrer" : undefined}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={commonClasses}>
      {content}
    </button>
  );
};
