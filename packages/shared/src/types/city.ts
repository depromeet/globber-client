// 백엔드 API 응답 타입
export type CityApiResponse = {
  cityResponseList: CityApiData[];
};

export type CityApiData = {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

// 프론트엔드에서 사용하는 도시 타입
export type City = {
  id: string;
  name: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  countryCode: string;
  selected?: boolean;
};

// API 요청 파라미터 타입
export type CityApiParams = {
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
};

// 검색 API 응답 타입
export type CitySearchResponse = {
  cities: CityApiData[];
};

// 검색 API 요청 파라미터 타입
export type CitySearchParams = {
  keyword: string;
};

// 도시 추가 API 요청 타입
export type AddCityRequest = {
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
};

// 도시 추가 API 응답 타입
export type AddCityResponse = {
  status: string;
  data: CityApiData;
};

// 도시 삭제 API 요청 타입
export type DeleteCityRequest = {
  cityId: number;
};

// 도시 삭제 API 응답 타입
export type DeleteCityResponse = {
  status: string;
  data: CityApiData;
};
