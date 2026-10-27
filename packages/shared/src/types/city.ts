// 백엔드 API 응답 타입
export interface CityApiResponse {
  cityResponseList: CityApiData[];
}

export interface CityApiData {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 프론트엔드에서 사용하는 도시 타입
export interface City {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  countryCode: string;
  selected?: boolean;
}

// API 요청 파라미터 타입
export interface CityApiParams {
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

// 검색 API 응답 타입
export interface CitySearchResponse {
  cities: CityApiData[];
}

// 검색 API 요청 파라미터 타입
export interface CitySearchParams {
  keyword: string;
}

// 도시 추가 API 요청 타입
export interface AddCityRequest {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}

// 도시 추가 API 응답 타입
export interface AddCityResponse {
  status: string;
  data: CityApiData;
}

// 도시 삭제 API 요청 타입
export type DeleteCityRequest = {
  cityId: number;
};

// 도시 삭제 API 응답 타입
export interface DeleteCityResponse {
  status: string;
  data: CityApiData;
}
