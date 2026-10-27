"use client";

import type {
  AddDiaryPhotoRequest,
  CreateDiaryRequest,
  DeleteDiaryPhotoRequest,
  DeleteDiaryRequest,
  DiaryPhoto,
  UpdateDiaryRequest,
  UploadTravelPhotoRequest,
} from "@globber/shared/types/diary";
import { useMutation } from "@tanstack/react-query";

import {
  addDiaryPhoto,
  createDiary,
  deleteDiary,
  deleteDiaryPhoto,
  updateDiary,
  uploadTravelPhoto,
} from "@/services/diaryService";

export const useUploadTravelPhotoMutation = () => {
  return useMutation<string, Error, UploadTravelPhotoRequest>({
    mutationFn: ({ file, token }) => uploadTravelPhoto(file, token),
  });
};

export const useCreateDiaryMutation = () => {
  return useMutation<number, Error, CreateDiaryRequest>({
    mutationFn: ({ params, token }) => createDiary(params, token),
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
  });
};

export const useAddDiaryPhotoMutation = () => {
  return useMutation<DiaryPhoto, Error, AddDiaryPhotoRequest>({
    mutationFn: ({ diaryId, photo, token }) => addDiaryPhoto(diaryId, photo, token),
  });
};

export const useUpdateDiaryMutation = () => {
  return useMutation<void, Error, UpdateDiaryRequest>({
    mutationFn: ({ diaryId, params, token }) => updateDiary(diaryId, params, token),
  });
};
