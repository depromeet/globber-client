import type {
  AddCityRequest,
  AddCityResponse,
  City,
  CityApiParams,
  CityApiResponse,
  CitySearchResponse,
  DeleteCityResponse,
} from "@globber/shared/types/city";
import { transformApiDataToCity } from "@globber/shared/utils/cityMapper";
import { logger } from "@globber/shared/utils/logger";

import { apiDelete, apiGet, apiPost } from "@/lib/apiClient";

export const fetchCities = async (params: CityApiParams = {}): Promise<City[]> => {
  try {
    const data = await apiGet<CityApiResponse>("/api/v1/cities/favorites", params);
    return data.data.cityResponseList.map(transformApiDataToCity);
  } catch (error) {
    logger.error("Failed to fetch cities:", error);
    throw error;
  }
};

export const searchCities = async (keyword: string): Promise<City[]> => {
  // 서버는 빈 검색어(공백만 있는 경우 포함)에 400을 주므로 요청하지 않는다
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return [];

  try {
    const data = await apiGet<CitySearchResponse>("/api/v1/cities", {
      keyword: trimmedKeyword,
    });
    return data.data.cities.map(transformApiDataToCity);
  } catch (error) {
    logger.error("Failed to search cities:", error);
    throw error;
  }
};

// 도시 추가 API
export const addCity = async (request: AddCityRequest, token: string): Promise<AddCityResponse> => {
  try {
    const data = await apiPost<AddCityResponse>("/api/v1/cities", request, token);
    return data;
  } catch (error) {
    logger.error("Failed to add city:", error);
    throw error;
  }
};

// 도시 삭제 API
export const deleteCity = async (cityId: number, token: string): Promise<DeleteCityResponse> => {
  try {
    const data = await apiDelete<DeleteCityResponse>(`/api/v1/cities/${cityId}`, undefined, token);
    return data;
  } catch (error) {
    logger.error("Failed to delete city:", error);
    throw error;
  }
};
