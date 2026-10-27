import type {
  AddCityRequest,
  AddCityResponse,
  City,
  CityApiParams,
  CityApiResponse,
  CitySearchResponse,
  DeleteCityResponse,
} from "@globber/shared/types/city";
import { transformApiDataToCity } from "@globber/shared/utils/countryFlagMapping";

import { apiDelete, apiGet, apiPost } from "@/lib/apiClient";

export const fetchCities = async (params: CityApiParams = {}): Promise<City[]> => {
  try {
    const data = await apiGet<CityApiResponse>("/api/v1/cities/favorites", params);
    return data.cityResponseList.map(transformApiDataToCity);
  } catch (error) {
    console.error("Failed to fetch cities:", error);
    throw error;
  }
};

export const searchCities = async (keyword: string): Promise<City[]> => {
  try {
    const data = await apiGet<CitySearchResponse>("/api/v1/cities", {
      keyword,
    });
    return data.cities.map(transformApiDataToCity);
  } catch (error) {
    console.error("Failed to search cities:", error);
    throw error;
  }
};

// 도시 추가 API
export const addCity = async (request: AddCityRequest, token: string): Promise<AddCityResponse> => {
  try {
    const data = await apiPost<AddCityResponse>("/api/v1/cities", request, token);
    return data;
  } catch (error) {
    console.error("Failed to add city:", error);
    throw error;
  }
};

// 도시 삭제 API
export const deleteCity = async (cityId: number, token: string): Promise<DeleteCityResponse> => {
  try {
    const data = await apiDelete<DeleteCityResponse>(`/api/v1/cities/${cityId}`, undefined, token);
    return data;
  } catch (error) {
    console.error("Failed to delete city:", error);
    throw error;
  }
};
