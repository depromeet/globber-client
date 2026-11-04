"use client";

import type {
  GetS3UploadUrlRequest,
  ProfileData,
  UploadAndUpdateProfileRequest,
  WithdrawMemberRequest,
} from "@globber/shared/types/member";
import { useMutation } from "@tanstack/react-query";

import { getS3UploadUrl, uploadAndUpdateProfile, withdrawMember } from "@/services/profileService";

export const useGetS3UploadUrlMutation = () => {
  return useMutation<{ presignedUrl: string; s3Key: string }, Error, GetS3UploadUrlRequest>({
    mutationFn: ({ uploadData, token }) => getS3UploadUrl(uploadData, token),
  });
};

export const useUploadAndUpdateProfileMutation = () => {
  return useMutation<ProfileData, Error, UploadAndUpdateProfileRequest>({
    mutationFn: ({ nickname, memberId, imageFile, token }) =>
      uploadAndUpdateProfile(nickname, memberId, imageFile, token),
  });
};

export const useWithdrawMemberMutation = () => {
  return useMutation<void, Error, WithdrawMemberRequest | void>({
    mutationFn: request => withdrawMember(request?.token),
  });
};
