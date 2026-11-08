"use client";

import {
  CreateMemberTravelsRequest,
  CreateTravelRecordsResponse,
  DeleteMemberTravelRequest,
} from "@globber/shared/types/member";
import { useMutation } from "@tanstack/react-query";

import { ApiError } from "@/lib/apiClient";
import { createMemberTravels, deleteMemberTravel } from "@/services/memberService";

export const useCreateMemberTravelsMutation = () => {
  return useMutation<CreateTravelRecordsResponse, Error, CreateMemberTravelsRequest>({
    mutationFn: data => {
      return createMemberTravels(data.cities);
    },
  });
};

export const useDeleteMemberTravelMutation = () => {
  return useMutation<void, Error, DeleteMemberTravelRequest>({
    // 404는 이미 내 여행지에 없다는 뜻이므로 삭제 완료로 본다.
    // 일부만 성공한 저장을 다시 시도하거나 다른 탭에서 먼저 지운 경우에 저장이 계속 실패하지 않게 한다.
    mutationFn: async ({ cityId, token }) => {
      try {
        await deleteMemberTravel(cityId, token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return;
        throw error;
      }
    },
  });
};
