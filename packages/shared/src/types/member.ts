import type { ApiResponse } from "./api";
import type { City } from "./city";

// 로그인 결과 (POST /auth/token: 로그인 성공 리다이렉트로 받은 일회용 code를 교환해 받음)
export type LoginResult = {
  accessToken: string; // "Bearer " 접두어 포함
  memberId: number;
  uuid: string;
  firstLogin: boolean;
};

export type LoginResultResponse = ApiResponse<LoginResult>;

// 여행 기록 생성 API
export type TravelRecord = {
  countryName: string;
  cityName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

// 여행지 삭제 API 요청 (DELETE /api/v1/member-travels/{cityId}, 성공 시 204 본문 없음)
export type DeleteMemberTravelRequest = {
  cityId: number;
  token?: string;
};

// 여행 기록 생성 API 응답
export type CreateTravelRecordsData = {
  recordsCreated: number;
  message: string;
};

export type CreateMemberTravelsRequest = {
  cities: City[];
};

export type CreateTravelRecordsResponse = ApiResponse<CreateTravelRecordsData>;

// 지구본 조회 API 응답
export type GlobeData = {
  memberId: number;
  nickname: string;
  cityCount: number;
  countryCount: number;
  regions: Region[];
};

export type Region = {
  regionName: string;
  cityCount: number;
  cities: GlobeCity[];
};

export type GlobeCity = {
  cityId: number;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
};

export type GlobeResponse = ApiResponse<GlobeData>;

// AI 인사이트 응답
export type TravelInsightData = {
  title: string;
};

export type TravelInsightResponse = ApiResponse<TravelInsightData>;

// 멤버 여행 데이터 조회 응답
export type MemberTravelCity = {
  cityId: number;
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export type MemberTravel = {
  cities: MemberTravelCity[];
};

export type MemberTravelsData = {
  memberId: number;
  travels: MemberTravel[];
};

export type MemberTravelsResponse = ApiResponse<MemberTravelsData>;

// 프로필 정보 타입
export type ProfileData = {
  memberId: number;
  nickname: string;
  email: string;
  profileImageUrl: string | undefined;
  authProvider: string;
};

// 프로필 조회 API 응답
export type ProfileResponse = ApiResponse<ProfileData>;

// S3 업로드 URL 요청 데이터
export type S3UploadUrlParams = {
  uploadType: string;
  fileName: string;
  contentType: string;
};

export type GetS3UploadUrlRequest = {
  uploadData: S3UploadUrlParams;
  token?: string;
};

// S3 업로드 URL 응답 데이터
export type S3UploadUrlData = {
  presignedUrl: string;
  s3Key: string;
  /** S3 PUT에 그대로 보내야 하는 헤더. 서명에 포함되므로 값이 다르면 업로드가 거절된다 (백엔드 GLB-157·215·323) */
  uploadHeaders?: Record<string, string>;
};

export type S3UploadUrlResponse = ApiResponse<S3UploadUrlData>;

export type UploadAndUpdateProfileRequest = {
  nickname: string;
  imageFile?: File;
  token?: string;
};

export type WithdrawMemberRequest = {
  token?: string;
};
