"use client";

import type {
  AddCityRequest,
  AddCityResponse,
  DeleteCityRequest,
  DeleteCityResponse,
} from "@globber/shared/types/city";
import { useMutation } from "@tanstack/react-query";

import { addCity, deleteCity } from "@/services/cityService";

export type AddCityVariables = {
  request: AddCityRequest;
  token: string;
};

export type DeleteCityVariables = {
  request: DeleteCityRequest;
  token: string;
};

export const useAddCityMutation = () => {
  return useMutation<AddCityResponse, Error, AddCityVariables>({
    mutationFn: ({ request, token }) => addCity(request, token),
  });
};

export const useDeleteCityMutation = () => {
  return useMutation<DeleteCityResponse, Error, DeleteCityVariables>({
    mutationFn: ({ request, token }) => deleteCity(request.cityId, token),
  });
};
