import type {
  CreateDiaryParams,
  CreateDiaryResponse,
  DiariesByUuidResponse,
  DiariesListResponse,
  DiaryData,
  DiaryDetail,
  DiaryDetailResponse,
  UpdateDiaryParams,
} from "@globber/shared/types/diary";
import { logger } from "@globber/shared/utils/logger";

import { env } from "@/config/env";
import { apiDelete, ApiError, apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { getAuthInfo } from "@/utils/cookies";

import { getS3UploadUrl, putToPresignedUrl, toUploadFileName } from "./profileService";

/**
 * DiaryData를 DiaryDetail로 변환합니다.
 *
 * @param {DiaryData} data - 변환할 diary 데이터
 * @returns {DiaryDetail} 변환된 diary 상세 정보
 */
const transformDiaryData = (data: DiaryData): DiaryDetail => {
  const { diaryId, city, text, createdAt, photos, emojis, memberId, nickname, profileImageUrl } = data;
  const { cityId, cityName, countryName, countryCode, lat, lng } = city;
  const baseUrl = env.S3_BASE_URL;
  const defaultProfileImage = "/assets/default-profile.png";
  const userAvatar = profileImageUrl ? baseUrl + profileImageUrl : defaultProfileImage;

  // 서버가 저장한 사진 표시 순서(display_order)대로 내려준다 (백엔드 GLB-164)
  const sortedPhotos = photos;

  const imageMetadata = sortedPhotos.map(({ photoCode, takenMonth, placeName, tag }) => {
    return {
      url: baseUrl + photoCode,
      takenMonth,
      placeName,
      tag,
    };
  });

  return {
    id: String(diaryId),
    cityId,
    city: cityName,
    country: countryName,
    countryCode,
    lat,
    lng,
    description: text,
    images: sortedPhotos.map(({ photoCode }) => baseUrl + photoCode),
    imageMetadata,
    reactions: emojis.map(({ code, glyph, count, pressedByMe }) => ({
      code,
      glyph,
      count,
      pressedByMe: pressedByMe ?? false,
    })),
    date: new Date(createdAt).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
    }),
    location: `${cityName}, ${countryName}`,
    userId: String(memberId),
    userName: nickname,
    userAvatar,
  };
};

/**
 * 단일 이미지를 S3에 업로드합니다.
 *
 * @param file - 업로드할 이미지 파일
 * @param metadata - 이미지 메타데이터
 * @param token - 인증 토큰 (선택)
 * @returns S3 키(photoCode)
 * @throws S3 업로드 실패 시
 *
 * @example
 * const photoCode = await uploadPhotoToS3(file, metadata);
 */
export const uploadTravelPhoto = async (file: File, token?: string): Promise<string> => {
  let authToken = token;

  if (!authToken) {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  const { presignedUrl, s3Key, uploadHeaders } = await getS3UploadUrl(
    {
      uploadType: "TRAVEL",
      fileName: toUploadFileName(file),
      contentType: file.type,
    },
    authToken
  );

  await putToPresignedUrl(presignedUrl, file, uploadHeaders);

  return s3Key;
};

/**
 * 여행기록을 생성합니다.
 *
 * @param params - 여행기록 생성 파라미터 (cityId, text, photos)
 * @param token - 인증 토큰 (선택)
 * @returns 생성된 여행기록 ID
 * @throws API 요청 실패 시
 *
 * @example
 * const diaryId = await createDiary({
 *   cityId: 123,
 *   text: "즐거운 여행이었습니다!",
 *   photos: [...]
 * });
 */
export const createDiary = async (params: CreateDiaryParams, token?: string): Promise<number> => {
  let authToken = token;

  if (!authToken) {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  const response = await apiPost<CreateDiaryResponse>("/api/v1/diaries", params, authToken);

  return response.data.diaryId;
};

/**
 * 여행기록 상세 정보를 조회합니다.
 *
 * @param {string | number} diaryId - 조회할 diary의 ID
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @returns {Promise<DiaryData>} 여행 기록 상세 정보
 * @throws 데이터 조회 실패 시 에러 발생
 *
 * @example
 * const diary = await getDiaryDetail(1);
 */
export const getDiaryDetail = async (diaryId: string | number, token?: string): Promise<DiaryData> => {
  let authToken = token;

  if (!authToken) {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    const response = await apiGet<DiaryDetailResponse>(`/api/v1/diaries/${diaryId}`, undefined, authToken);
    return response.data;
  } catch (error) {
    logger.error("[getDiaryDetail] 실패:", error);
    if (error instanceof ApiError) throw error;
    throw new Error("여행 기록을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * UUID로 특정 사용자의 모든 여행기록을 조회합니다.
 *
 * @param {string} uuid - 조회할 사용자의 UUID
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @returns {Promise<DiaryDetail[]>} diary 목록
 * @throws 데이터 조회 실패 시 에러 발생
 *
 * @example
 * // 서버 컴포넌트에서 사용
 * const diaries = await getDiariesByUuid(uuid, token);
 *
 * // 클라이언트 컴포넌트에서 사용
 * const diaries = await getDiariesByUuid(uuid);
 */
export const getDiariesByUuid = async (uuid: string, token?: string): Promise<DiaryDetail[]> => {
  try {
    const response = await apiGet<DiariesByUuidResponse>(`/api/v1/diaries?uuid=${uuid}`, {}, token);
    // 각 DiaryResponse의 diaries 배열을 순회하며 변환
    return response.data.diaryResponses.flatMap(diaryResponse =>
      diaryResponse.diaries.map(diaryData => transformDiaryData(diaryData))
    );
  } catch (error) {
    logger.error("[getDiariesByUuid] 실패:", error);
    throw new Error("여행 기록을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 여행기록을 삭제합니다.
 *
 * @param {string | number} diaryId - 삭제할 diary의 ID
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @returns {Promise<void>}
 * @throws 데이터 삭제 실패 시 에러 발생
 *
 * @example
 * // 클라이언트 컴포넌트에서 사용
 * await deleteDiary(1);
 */
export const deleteDiary = async (diaryId: string | number, token?: string): Promise<void> => {
  let authToken = token;

  if (!authToken) {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    await apiDelete(`/api/v1/diaries/${diaryId}`, undefined, authToken);
  } catch (error) {
    logger.error("[deleteDiary] 실패:", error);
    throw new Error("여행 기록 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};

/**
 * 특정 UUID의 모든 여행 기록을 조회합니다.
 * Authorization 토큰이 필요하지 않습니다.
 *
 * @param {string} uuid - 조회할 사용자의 UUID
 * @returns {Promise<DiaryDetail[]>} 여행 기록 목록
 * @throws 데이터 조회 실패 시 에러 발생
 *
 * @example
 * const diaries = await getDiariesByUuid('uuid');
 */
export const getDiariesList = async (uuid: string) => {
  try {
    const response = await apiGet<DiariesListResponse>("/api/v1/diaries", { uuid });

    // response.data.diaryResponses가 없거나 배열이 아닌 경우 빈 배열 반환
    if (!response.data?.diaryResponses || !Array.isArray(response.data.diaryResponses)) {
      return [];
    }

    return response.data.diaryResponses;
  } catch (error) {
    logger.error("여행기록 조회에 실패했습니다.", error);
    return [];
  }
};

/**
 * 여행기록을 수정합니다.
 *
 * @param {string | number} diaryId - 수정할 diary의 ID
 * @param {UpdateDiaryParams} params - 수정할 내용
 * @param {string} [token] - 선택사항. 서버에서 전달받은 인증 토큰
 * @returns {Promise<void>}
 * @throws 데이터 수정 실패 시 에러 발생
 *
 * @example
 * await updateDiary(1, {
 *   cityId: 123,
 *   text: "여행 기록 수정",
 *   photos: [...]
 * });
 */
export const updateDiary = async (
  diaryId: string | number,
  params: UpdateDiaryParams,
  token?: string
): Promise<void> => {
  let authToken = token;

  if (!authToken) {
    const { token: clientToken } = getAuthInfo();
    authToken = clientToken || undefined;
  }

  if (!authToken) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
  }

  try {
    await apiPut(`/api/v1/diaries/${diaryId}`, params, authToken);
  } catch (error) {
    logger.error("[updateDiary] 실패:", error);
    if (error instanceof ApiError) throw error;
    throw new Error("여행 기록 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};
