"use client";

import {
  CreateMemberTravelsRequest,
  CreateTravelRecordsResponse,
  DeleteMemberTravelRequest,
  DeleteTravelRecordsResponse,
} from "@globber/shared/types/member";
import { useMutation } from "@tanstack/react-query";

import { createMemberTravels, deleteMemberTravel } from "@/services/memberService";

export const useCreateMemberTravelsMutation = () => {
  return useMutation<CreateTravelRecordsResponse, Error, CreateMemberTravelsRequest>({
    mutationFn: data => {
      return createMemberTravels(data.cities);
    },
  });
};

export const useDeleteMemberTravelMutation = () => {
  return useMutation<DeleteTravelRecordsResponse, Error, DeleteMemberTravelRequest>({
    mutationFn: ({ travelRecord, token }) => deleteMemberTravel(travelRecord, token),
  });
};
