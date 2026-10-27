"use client";

import { useRouter } from "next/navigation";

import { ChevronLeft } from "lucide-react";

type ProfileHeaderProps = {
  title: string;
};

export const ProfileHeader = ({ title }: ProfileHeaderProps) => {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/profile"); // 또는 적절한 폴백 경로
    }
  };

  return (
    <div className="fixed h-11 left-0 right-0 top-16 max-w-[402px] mx-auto w-full z-10">
      <button
        type="button"
        onClick={handleBack}
        className="absolute box-border content-stretch flex gap-2.5 items-center left-4 overflow-clip p-2.5 top-0"
        aria-label="뒤로 가기"
      >
        <ChevronLeft className="size-6 text-text-primary" />
      </button>
      <div className="absolute flex flex-col font-bold justify-center leading-none left-1/2 not-italic text-lg text-text-primary text-center text-nowrap top-1/2 tracking-[-0.36px] translate-x-[-50%] translate-y-[-50%]">
        <p>{title}</p>
      </div>
    </div>
  );
};
