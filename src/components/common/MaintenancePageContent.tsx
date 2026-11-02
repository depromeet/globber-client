"use client";

import Image from "next/image";

import Error500Icon from "@/assets/icons/500_error.png";
import { Button } from "@/components/common/Button";

const MAINTENANCE_DETAILS = [
  { label: "점검 내용", value: "여행 사진 표시 오류 수정" },
  { label: "진행 상태", value: "작업 중", highlight: true },
  { label: "재개 예정", value: "복구 완료 즉시" },
];

// 점검이 끝났다면 원래 요청한 페이지가 그대로 열린다 (점검 중에는 URL을 유지한 채 rewrite 되므로)
const handleRefresh = () => {
  window.location.reload();
};

export function MaintenancePageContent() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-24 h-24 relative">
            <Image src={Error500Icon} alt="" fill priority className="object-contain" />
          </div>
          <h1 className="text-text-primary text-[26px] font-bold leading-[34px]">서비스 점검 중입니다</h1>
          <p className="text-text-secondary text-base font-medium leading-relaxed">
            이용에 불편을 드려 죄송합니다.
            <br />
            최대한 빠르게 복구하겠습니다.
          </p>
        </div>
        <dl className="flex flex-col rounded-[20px] bg-surface-placeholder--8 px-[18px] py-1.5">
          {MAINTENANCE_DETAILS.map(({ label, value, highlight }) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 py-3.5 text-[15px] [&+&]:border-t [&+&]:border-surface-placeholder--8"
            >
              <dt className="shrink-0 text-gray-400">{label}</dt>
              <dd
                className={
                  highlight ? "text-right font-medium text-blue-0" : "text-right font-medium text-text-primary"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" size="lg" onClick={handleRefresh} className="w-full">
            새로고침
          </Button>
          <p className="text-center text-[13px] text-text-thirdly">저장된 여행 기록은 안전하게 보관되어 있어요.</p>
        </div>
      </div>
    </div>
  );
}
