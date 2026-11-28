import { cookies } from "next/headers";

import type { ImageMetadataFromDiary } from "@globber/shared/types/diary";
import type { Emoji } from "@globber/shared/types/emoji";
import { sortDiariesByCountryGrouping } from "@globber/shared/utils/recordUtils";

import RecordDetailClient from "@/components/record/RecordDetailClient";
import RecordDetailViewTracker from "@/components/record/RecordDetailViewTracker";
import { AUTH_COOKIE } from "@/constants/authCookies";
import { getDiariesByUuid } from "@/services/diaryService";
import { handleServerError } from "@/utils/serverErrorHandler";

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

/** 오류 화면에서 돌아올 기록 상세 주소를 만든다 (GLB-242) */
const buildRecordDetailPath = (id: string, uuid: string, scrollIndex?: string) => {
  const query = new URLSearchParams({ uuid });
  if (scrollIndex !== undefined) query.set("scrollIndex", scrollIndex);
  return `/record/${encodeURIComponent(id)}?${query.toString()}`;
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
  const cookieUuid = cookieStore.get(AUTH_COOKIE.UUID)?.value;
  const token = cookieStore.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;

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
      // 401·5xx는 다른 서버 페이지처럼 오류 화면으로 보냄 (GLB-242)
      // 500 화면의 "다시 시도"가 같은 기록을 다시 열 수 있도록 지금 주소를 함께 넘김 (GLB-135)
      handleServerError(error, buildRecordDetailPath(resolvedParams.id, queryUuid, scrollIndexParam));
      // 그 밖의 실패는 API 오류 원문 대신 고정 문구로 안내함 (GLB-240)
      serverError = "여행 기록을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.";
    }
  }

  // 범위 밖이거나 숫자가 아닌 scrollIndex로 들어와도 빈 화면이 되지 않도록 기록 범위 안으로 맞춤 (GLB-153)
  const parsedScrollIndex = Number(scrollIndexParam);
  const lastRecordIndex = Math.max(initialRecords.length - 1, 0);
  const initialScrollIndex = Number.isInteger(parsedScrollIndex)
    ? Math.min(Math.max(parsedScrollIndex, 0), lastRecordIndex)
    : 0;

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
        queryUuid={queryUuid || null}
        isOwner={isOwner}
        initialScrollIndex={initialScrollIndex}
      />
    </>
  );
}
