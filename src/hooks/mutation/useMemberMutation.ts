"use client";

import { useMutation } from "@tanstack/react-query";

import { createMemberTravels, deleteMemberTravel } from "@/services/memberService";
import { CreateMemberTravelsRequest, CreateTravelRecordsResponse, DeleteMemberTravelRequest } from "@/types/member";

export const useCreateMemberTravelsMutation = () => {
  return useMutation<CreateTravelRecordsResponse, Error, CreateMemberTravelsRequest>({
    mutationFn: data => {
      return createMemberTravels(data.cities);
    },
  });
};

export const useDeleteMemberTravelMutation = () => {
  return useMutation<void, Error, DeleteMemberTravelRequest>({
    mutationFn: ({ cityId, token }) => deleteMemberTravel(cityId, token),
  });
};
