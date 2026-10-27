export type CountryData = {
  id: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  color: string;
  cityId?: number; // API에서 제공하는 도시 ID
  hasRecords?: boolean; // 해당 국가 내 1개 이상의 도시 기록 여부
  thumbnailUrl?: string; // 가장 최근에 기록된 사진 (대표 이미지)
  thumbnails?: string[]; // 여행기록 썸네일 배열 (최대 2개, 최신순)
  recordCount?: number; // 해당 도시의 총 여행 기록 개수
  cityCount?: number; // 해당 국가의 도시 수 (초기 앵커링 기준)
  updatedAt?: string; // 최근 기록 시간 (동률 처리 기준, ISO 8601 형식)
};

export type TravelPattern = {
  title: string;
  subtitle: string;
  countries: CountryData[];
};
