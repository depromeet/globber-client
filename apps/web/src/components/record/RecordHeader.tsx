"use client";

import { useRouter } from "next/navigation";

import { BackIcon } from "@/assets/icons";
import { getAuthInfo } from "@/utils/cookies";

export function RecordHeader() {
  const router = useRouter();

  const handleBackClick = () => {
    const { uuid } = getAuthInfo();
    if (uuid) {
      router.push(`/globe/${uuid}`);
    }
  };

  const handleEditClick = () => {
    router.push("/record/edit");
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center">
        <button type="button" onClick={handleBackClick} className="flex justify-start items-center">
          <BackIcon className="w-6 h-6" />
        </button>
        <button onClick={handleEditClick} type="button" className="px-2 inline-flex justify-end items-center">
          <div className="text-right justify-start text-state-focused text-base font-bold leading-5">도시 편집</div>
        </button>
      </div>
    </div>
  );
}
