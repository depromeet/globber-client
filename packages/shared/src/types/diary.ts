/**
 * Diary API 응답 타입 정의
 */

import type { Emoji } from "./emoji";
import type { ImageTag } from "./imageMetadata";

export type DiaryCity = {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

export type DiaryPhotoTakenMonth =
  | {
      year: number;
      month: string;
      monthValue: number;
      leapYear: boolean;
    }
  | string;

export type DiaryPhoto = {
  photoId: number;
  photoCode: string;
  lat: number;
  lng: number;
  width: number;
  height: number;
  takenMonth: DiaryPhotoTakenMonth | null;
  placeName: string | null;
  tag: ImageTag | null;
};

export type DiaryPhotoResponse = {
  status: string;
  data: DiaryPhoto;
};

export type DiaryEmoji = Emoji;

export type DiaryData = {
  diaryId: number;
  city: DiaryCity;
  text: string;
  createdAt: string;
  updatedAt: string;
  photos: DiaryPhoto[];
  emojis: DiaryEmoji[];
  memberId: number;
  nickname: string;
  profileImageUrl?: string;
};

export type DiaryDetailResponse = {
  status: string;
  data: DiaryData;
};

export type DiariesListResponse = {
  status: string;
  data: {
    diaryResponses: {
      city: DiaryCity;
      /* 충돌 우려하여 별도로 타입 작성. 추후 공통 타입으로 변경 */
      diaries: {
        diaryId: number;
        city: DiaryCity;
        text: string;
        createdAt: string;
        updatedAt: string;
        photos: {
          photoId: number;
          photoCode: string;
          lat: number;
          lng: number;
          width: number;
          height: number;
          takenMonth: string;
          placeName: string;
          tag: string;
        }[];
        emojis: DiaryEmoji[];
        memberId: number;
        nickname: string;
        profileImageUrl?: string;
      }[];
    }[];
  };
};

export type CreateDiaryResponse = {
  status: string;
  data: {
    diaryId: number;
    city: DiaryCity;
    text: string;
    createdAt: string;
    updatedAt: string;
    photos: DiaryPhoto[];
    emojis: DiaryEmoji[];
  };
};

export type DiaryResponse = {
  city: DiaryCity;
  diaries: DiaryData[];
};

export type DiariesByUuidResponse = {
  status: string;
  data: {
    diaryResponses: DiaryResponse[];
  };
};

/**
 * 클라이언트에서 사용하는 이미지 메타데이터 타입
 */
export type ImageMetadataFromDiary = {
  url: string;
  takenMonth: DiaryPhotoTakenMonth | null;
  placeName: string | null;
  tag: ImageTag | null;
};

/**
 * 클라이언트에서 사용하는 변환된 타입
 */
export type DiaryDetail = {
  id: string;
  cityId: number;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  description: string;
  images: string[];
  imageMetadata: ImageMetadataFromDiary[];
  reactions: Emoji[];
  date: string;
  location: string;
  userId: string;
  userName: string;
  userAvatar?: string;
};

export type CreateDiaryPhotoParams = {
  photoId?: number;
  photoCode: string;
  lat?: number;
  lng?: number;
  width: number;
  height: number;
  takenMonth?: string | null;
  tag?: ImageTag;
  placeName?: string;
};

export type CreateDiaryRequest = {
  params: CreateDiaryParams;
  token?: string;
};

export type CreateDiaryParams = {
  cityId: number;
  text?: string;
  photos: CreateDiaryPhotoParams[];
};

export type UpdateDiaryParams = {
  cityId: number;
  text?: string;
  photos: CreateDiaryPhotoParams[];
};

export type UpdateDiaryRequest = {
  diaryId: string | number;
  params: UpdateDiaryParams;
  token?: string;
};

export type UploadTravelPhotoRequest = {
  file: File;
  token?: string;
};

export type DeleteDiaryRequest = {
  diaryId: string | number;
  token?: string;
};

export type DeleteDiaryPhotoRequest = {
  diaryId: string | number;
  photoId: number;
  token?: string;
};

export type AddDiaryPhotoRequest = {
  diaryId: string | number;
  photo: CreateDiaryPhotoParams;
  token?: string;
};
