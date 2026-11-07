export type RecordCity = {
  cityId: number;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
};

export type RecordRegion = {
  regionName: string;
  cityCount: number;
  cities: RecordCity[];
};

export type RecordData = {
  cityCount: number;
  countryCount: number;
  regions: RecordRegion[];
};

export type RecordResponse = {
  status: string;
  data: RecordData;
};

export type Continent = "전체" | "아시아" | "유럽" | "북미" | "남미" | "아프리카" | "오세아니아";
