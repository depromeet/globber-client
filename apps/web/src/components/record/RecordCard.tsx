"use client";

import { useEffect, useRef, useState } from "react";

import type { ImageMetadataFromDiary } from "@globber/shared/types/diary";
import type { Emoji } from "@globber/shared/types/emoji";
import { filterValidImageUrls } from "@globber/shared/utils/imageValidation";

import { isCoordinateFormat } from "@/utils/geocoding";

import { RecordImageCarousel } from "./RecordImageCarousel";
import { RecordMetaInfo } from "./RecordMetaInfo";
import { RecordReactions } from "./RecordReactions";
import { RecordUserInfo } from "./RecordUserInfo";

type RecordCardProps = {
  id: string;
  images: string[];
  imageMetadata?: ImageMetadataFromDiary[];
  userName: string;
  userAvatar?: string;
  description?: string;
  reactions?: Emoji[];
  isOwner?: boolean;
  showScrollHint?: boolean;
  isFirstRecord?: boolean;
};

const formatTakenMonth = (
  takenMonth: string | { year: number; month: string; monthValue: number; leapYear: boolean } | null | undefined
): string | undefined => {
  if (!takenMonth) return undefined;
  if (typeof takenMonth === "string") {
    if (takenMonth.length === 6 && /^\d{4}\d{2}$/.test(takenMonth)) {
      const year = takenMonth.slice(0, 4);
      const month = takenMonth.slice(4, 6);
      return `${year}.${month}`;
    }
    return takenMonth;
  }
  if (takenMonth.year && takenMonth.monthValue) {
    const monthStr = String(takenMonth.monthValue).padStart(2, "0");
    return `${takenMonth.year}.${monthStr}`;
  }
  return undefined;
};

export const RecordCard = ({
  id,
  images,
  imageMetadata,
  userName,
  userAvatar,
  description,
  reactions,
  isOwner = false,
  showScrollHint = false,
  isFirstRecord = false,
}: RecordCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [userInfoHeight, setUserInfoHeight] = useState(0);
  const userInfoRef = useRef<HTMLDivElement>(null);

  // 이미지 URL 검증 (추가 방어 로직)
  const validImages = filterValidImageUrls(images);

  // RecordUserInfo 높이 측정
  useEffect(() => {
    if (userInfoRef.current) {
      setUserInfoHeight(userInfoRef.current.offsetHeight);
    }
  }, []);

  // 현재 이미지의 메타데이터 가져오기
  const currentMetadata = imageMetadata?.[currentImageIndex];
  const currentCategory = currentMetadata?.tag && currentMetadata.tag !== "NONE" ? currentMetadata.tag : undefined;
  const currentDate = formatTakenMonth(currentMetadata?.takenMonth);

  // placeName이 있고 좌표 형식이 아닐 때만 표시, 없으면 undefined (도시명 fallback 사용 안함)
  const currentLocation =
    currentMetadata?.placeName && !isCoordinateFormat(currentMetadata.placeName)
      ? currentMetadata.placeName
      : undefined;

  return (
    <div className="w-full h-full bg-surface-secondary flex flex-col relative" data-record-card>
      <div
        className="relative min-h-0 flex-1 w-full"
        onTouchStart={e => {
          // 이미지 캐러셀 내부에서는 수평 스와이프만 허용
          const target = e.target as HTMLElement;
          if (target.closest(".swiper") || target.closest("[data-carousel]")) {
            e.stopPropagation();
          }
        }}
      >
        <RecordImageCarousel
          images={validImages}
          onImageChange={setCurrentImageIndex}
          userInfoHeight={userInfoHeight}
          isFirstRecord={isFirstRecord}
          recordId={id}
          isOwner={isOwner}
        />

        {/* 상단 그라데이션 오버레이 */}
        <div
          className="absolute top-0 left-0 right-0 h-[207px] pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(0, 0, 0, 0.28) 0%, rgba(178, 178, 178, 0) 100%)",
          }}
        />

        {/* 하단 그라데이션 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 h-[167px] pointer-events-none">
          <div
            className="h-full rotate-180"
            style={{
              background: "linear-gradient(180deg, #001326 0%, rgba(0, 19, 38, 0) 100%)",
            }}
          />
        </div>

        {/* 메타 정보 (태그, 날짜, 위치) */}
        <div className="absolute top-[78px] left-4 z-10">
          <RecordMetaInfo category={currentCategory} date={currentDate} location={currentLocation} />
        </div>

        {/* 사용자 정보 및 설명 */}
        <div ref={userInfoRef} className="absolute bottom-0 left-4 right-4 pb-5 z-10">
          <RecordUserInfo userName={userName} userAvatar={userAvatar} description={description} />
        </div>
      </div>

      {/* 하단 영역 - 이모지 반응 */}
      {/* 힌트 표시 여부에 따라 패딩 동적 변경: 힌트 있음(20px+힌트높이+16px≈104px), 없음(20px) */}
      <div
        className={`px-4 pr-0 shrink-0 relative z-20 ${showScrollHint ? "pb-[calc(20px+49px+16px)]" : "pb-[20px]"}`}
        data-emoji-reactions
        onTouchStart={e => {
          e.stopPropagation();
        }}
        onTouchMove={e => {
          e.stopPropagation();
        }}
        onTouchEnd={e => {
          e.stopPropagation();
        }}
        onMouseDown={e => {
          e.stopPropagation();
        }}
        onWheel={e => {
          e.stopPropagation();
        }}
      >
        <RecordReactions recordId={id} initialReactions={reactions || []} isOwner={isOwner} />
      </div>
    </div>
  );
};
