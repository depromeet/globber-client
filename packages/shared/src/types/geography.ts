// 지역/국가 관련 공통 타입 정의

export type KoreanContinent = "아시아" | "유럽" | "북아메리카" | "남아메리카" | "오세아니아" | "아프리카";

// World Countries 라이브러리의 국가 데이터 타입
export type WorldCountry = {
  cca2?: string;
  cca3: string;
  region?: string;
  subregion?: string;
  name?: { common?: string };
  translations?: { [key: string]: { common?: string } };
};

// 지구본 관련 좌표 타입
export type PointOfView = {
  lat?: number;
  lng?: number;
  altitude?: number;
};

// GeoJSON Feature 타입
export type GeoJSONFeature = {
  id?: string | number;
  properties: {
    NAME?: string;
    ISO_A2?: string;
    [key: string]: unknown;
  };
  geometry: unknown;
  type: string;
};
