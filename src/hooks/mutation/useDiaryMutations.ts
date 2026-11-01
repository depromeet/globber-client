"use client";

import { useMutation } from "@tanstack/react-query";

import {
  addDiaryPhoto,
  createDiary,
  deleteDiary,
  deleteDiaryPhoto,
  updateDiary,
  uploadTravelPhoto,
} from "@/services/diaryService";
import type {
  AddDiaryPhotoRequest,
  CreateDiaryRequest,
  DeleteDiaryPhotoRequest,
  DeleteDiaryRequest,
  DiaryPhoto,
  UpdateDiaryRequest,
  UploadTravelPhotoRequest,
} from "@/types/diary";

// useImageMetadata/useDiaryAction의 catch에서 작업별 태그로 Sentry에 보고하므로 전역 보고에서 제외
const REPORT_HANDLED_META = { reportHandled: true };

export const useUploadTravelPhotoMutation = () => {
  return useMutation<string, Error, UploadTravelPhotoRequest>({
    mutationFn: ({ file, token }) => uploadTravelPhoto(file, token),
    meta: REPORT_HANDLED_META,
  });
};

export const useCreateDiaryMutation = () => {
  return useMutation<number, Error, CreateDiaryRequest>({
    mutationFn: ({ params, token }) => createDiary(params, token),
    meta: REPORT_HANDLED_META,
  });
};

export const useDeleteDiaryMutation = () => {
  return useMutation<void, Error, DeleteDiaryRequest>({
    mutationFn: ({ diaryId, token }) => deleteDiary(diaryId, token),
  });
};

export const useDeleteDiaryPhotoMutation = () => {
  return useMutation<void, Error, DeleteDiaryPhotoRequest>({
    mutationFn: ({ diaryId, photoId, token }) => deleteDiaryPhoto(diaryId, photoId, token),
    meta: REPORT_HANDLED_META,
  });
};

export const useAddDiaryPhotoMutation = () => {
  return useMutation<DiaryPhoto, Error, AddDiaryPhotoRequest>({
    mutationFn: ({ diaryId, photo, token }) => addDiaryPhoto(diaryId, photo, token),
    meta: REPORT_HANDLED_META,
  });
};

export const useUpdateDiaryMutation = () => {
  return useMutation<void, Error, UpdateDiaryRequest>({
    mutationFn: ({ diaryId, params, token }) => updateDiary(diaryId, params, token),
    meta: REPORT_HANDLED_META,
  });
};
