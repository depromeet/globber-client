import { cookies } from "next/headers";

import type { ImageMetadataFromDiary } from "@globber/shared/types/diary";
import type { Emoji } from "@globber/shared/types/emoji";
import { sortDiariesByCountryGrouping } from "@globber/shared/utils/recordUtils";

import RecordDetailClient from "@/components/record/RecordDetailClient";
import RecordDetailViewTracker from "@/components/record/RecordDetailViewTracker";
import { getDiariesByUuid } from "@/services/diaryService";

type RecordData = {
  id: string;
  cityId: number;
  city: string;
  country: string;
  images: string[];
  imageMetadata?: ImageMetadataFromDiary[];
  userId: string;
  userName: string;
  userAvatar?: string;
  description?: string;
  reactions?: Emoji[];
};

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const cityId = Number(resolvedParams.id) || 0;
  const queryUuid = resolvedSearchParams.uuid;
  const scrollIndexParam = resolvedSearchParams.scrollIndex;

  const cookieStore = await cookies();
  const cookieUuid = cookieStore.get("uuid")?.value;
  const token = cookieStore.get("kakao_access_token")?.value;

  const isOwner = Boolean(queryUuid && cookieUuid && queryUuid === cookieUuid);

  let initialRecords: RecordData[] = [];
  let serverError: string | null = null;

  if (!cityId || cityId <= 0) {
    serverError = "유효하지 않은 도시 ID입니다";
  } else if (!queryUuid) {
    serverError = "UUID가 필요합니다";
  } else {
    try {
      const diaries = await getDiariesByUuid(queryUuid, token);

      if (diaries.length === 0) {
        serverError = "여행 기록이 없습니다";
      } else {
        const selectedDiary = diaries.find(diary => diary.cityId === cityId);
        if (!selectedDiary) {
          serverError = "해당 도시의 여행 기록을 찾을 수 없습니다";
        } else {
          const sortedDiaries = sortDiariesByCountryGrouping(diaries, cityId);

          initialRecords = sortedDiaries.map(
            ({
              id,
              cityId,
              city,
              country,
              images,
              imageMetadata,
              description,
              reactions,
              userId,
              userName,
              userAvatar,
            }) => ({
              id,
              cityId,
              city,
              country,
              images: images.length > 0 ? images : [],
              imageMetadata,
              userId,
              userName,
              userAvatar,
              description,
              reactions,
            })
          );
        }
      }
    } catch (error) {
      serverError = error instanceof Error ? error.message : "기록을 불러오는 중 오류가 발생했습니다";
    }
  }

  const initialScrollIndex = scrollIndexParam ? Number(scrollIndexParam) : 0;

  const selectedRecord = initialRecords.find(r => r.cityId === cityId);

  return (
    <>
      {selectedRecord && !serverError && (
        <RecordDetailViewTracker
          recordId={selectedRecord.id}
          cityId={cityId}
          photoCount={selectedRecord.images.length}
          isOwner={isOwner}
        />
      )}
      <RecordDetailClient
        initialRecords={initialRecords}
        serverError={serverError}
        cityId={cityId}
        queryUuid={queryUuid || null}
        isOwner={isOwner}
        initialScrollIndex={initialScrollIndex}
      />
    </>
  );
}
