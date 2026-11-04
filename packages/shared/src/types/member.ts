import type { ApiResponse } from "./api";
import type { City } from "./city";

// 멤버 ID 조회 응답
export type MemberIdResponse = ApiResponse<number>;

// 여행 기록 생성 API
export interface TravelRecord {
  countryName: string;
  cityName: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 여행 기록 삭제 API 요청
export interface DeleteTravelRecord {
  countryCode: string;
  cityName: string;
  lat: number;
  lng: number;
}

export interface DeleteMemberTravelRequest {
  travelRecord: DeleteTravelRecord;
  token?: string;
}

// 여행 기록 삭제 API 응답
export interface DeleteTravelRecordsResponse {
  status: string;
  data: Record<string, never>;
}

// 여행 기록 생성 API 응답
export interface CreateTravelRecordsData {
  recordsCreated: number;
  message: string;
}

export interface CreateMemberTravelsRequest {
  cities: City[];
}

export type CreateTravelRecordsResponse = ApiResponse<CreateTravelRecordsData>;

// 지구본 조회 API 응답
export interface GlobeData {
  memberId: number;
  nickname: string;
  cityCount: number;
  countryCount: number;
  regions: Region[];
}

export interface Region {
  regionName: string;
  cityCount: number;
  cities: GlobeCity[];
}

export interface GlobeCity {
  cityId: number;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
}

export type GlobeResponse = ApiResponse<GlobeData>;

// AI 인사이트 응답
export interface TravelInsightData {
  title: string;
}

export type TravelInsightResponse = ApiResponse<TravelInsightData>;

// 멤버 여행 데이터 조회 응답
export interface MemberTravelCity {
  cityId: number;
  cityName: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface MemberTravel {
  cities: MemberTravelCity[];
}

export interface MemberTravelsData {
  memberId: number;
  travels: MemberTravel[];
}

export type MemberTravelsResponse = ApiResponse<MemberTravelsData>;

// 프로필 정보 타입
export interface ProfileData {
  memberId: number;
  nickname: string;
  email: string;
  profileImageUrl: string | undefined;
  authProvider: string;
}

// 프로필 조회 API 응답
export type ProfileResponse = ApiResponse<ProfileData>;

// S3 업로드 URL 요청 데이터
export interface S3UploadUrlParams {
  uploadType: string;
  resourceId: number;
  fileName: string;
  contentType: string;
}

export interface GetS3UploadUrlRequest {
  uploadData: S3UploadUrlParams;
  token?: string;
}

// S3 업로드 URL 응답 데이터
export interface S3UploadUrlData {
  presignedUrl: string;
  s3Key: string;
}

export type S3UploadUrlResponse = ApiResponse<S3UploadUrlData>;

export interface UploadAndUpdateProfileRequest {
  nickname: string;
  memberId: number;
  imageFile?: File;
  token?: string;
}

export interface WithdrawMemberRequest {
  token?: string;
}
