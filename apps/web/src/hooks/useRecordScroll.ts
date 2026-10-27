import { useCallback, useEffect, useState } from "react";

import type { ImageMetadataFromDiary } from "@globber/shared/types/diary";
import type { Emoji } from "@globber/shared/types/emoji";

type RecordScrollItem = {
  id: string;
  cityId: number;
  city: string;
  country: string;
  images: string[];
  imageMetadata?: ImageMetadataFromDiary[];
  category?: string;
  date?: string;
  location?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  description?: string;
  reactions?: Emoji[];
};

type UseRecordScrollParams = {
  countryRecords: RecordScrollItem[];
  shouldShowHint?: boolean;
  initialIndex?: number;
};

type UseRecordScrollReturn = {
  currentRecord: RecordScrollItem | null;
  currentIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
  showScrollHint: boolean;
  onScroll: (index: number) => void;
  hideScrollHint: () => void;
};

export const useRecordScroll = ({
  countryRecords,
  shouldShowHint = true,
  initialIndex = 0,
}: UseRecordScrollParams): UseRecordScrollReturn => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [countryRecords, initialIndex]);

  // 현재 기록
  const currentRecord = countryRecords[currentIndex] || null;

  // 다음/이전 존재 여부
  const hasNext = currentIndex < countryRecords.length - 1;
  const hasPrevious = currentIndex > 0;

  // 외부에서 인덱스 변경 시 (스냅 스크롤)
  const onScroll = useCallback(
    (index: number) => {
      if (index >= 0 && index < countryRecords.length) {
        setCurrentIndex(index);

        // 스크롤이 발생하면 힌트 숨김
        if (index > 0 && showScrollHint) {
          setShowScrollHint(false);
        }
      }
    },
    [countryRecords.length, showScrollHint]
  );

  // 힌트 수동 숨김
  const hideScrollHint = useCallback(() => {
    setShowScrollHint(false);
  }, []);

  // 초기 힌트 표시 (해당 국가의 기록 수 >= 2일 때만)
  // shouldShowHint 프로퍼티로 페이지 레벨의 제어를 받음
  useEffect(() => {
    if (countryRecords.length < 2 || !shouldShowHint) {
      setShowScrollHint(false);
      return;
    }

    setShowScrollHint(true);
  }, [countryRecords.length, shouldShowHint]);

  return {
    currentRecord,
    currentIndex,
    hasNext,
    hasPrevious,
    showScrollHint,
    onScroll,
    hideScrollHint,
  };
};
