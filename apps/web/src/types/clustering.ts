// 클러스터링 관련 타입 정의
import type { CountryData } from "@globber/shared/types/travelPatterns";
import type { GlobeInstance } from "globe.gl";

export type ClusterData = {
  id: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  color: string;
  items: CountryData[];
  count: number;
  clusterType?: "individual_city" | "country_cluster" | "continent_cluster";
  isExpanded?: boolean;
  hasRecords?: boolean; // 해당 클러스터에 여행 기록이 있는지 여부
  thumbnailUrl?: string; // 클러스터의 대표 썸네일
  recordCount?: number; // 해당 클러스터(도시)의 총 여행 기록 개수
};

export type ClusteringState = {
  mode: "country" | "city" | "continent";
  expandedCountry: string | null;
  selectedCluster: string | null;
  clusteredData: ClusterData[];
  lastInteraction: number;
  clickBasedExpansion: boolean;
  rotationPosition: { lat: number; lng: number };
  lastSignificantRotation: number;
  isZoomAnimating: boolean; // 줌 애니메이션 중인지 여부
  // 대륙 클러스터 확장 시 개별 표시할 국가 ID 집합 (홍콩-마카오 등 근접 국가 대륙 클러스터 방지)
  expandedContinentCountryIds: ReadonlySet<string>;
};

export type UseClusteringProps = {
  countries: CountryData[];
  zoomLevel: number;
  selectedClusterData?: CountryData[];
  globeRef: React.RefObject<GlobeInstance | null>;
  countryThumbnails?: Record<string, string>;
  onSelectedDataChange: (data: CountryData[] | null) => void;
  onSnapZoomChange: (zoom: number | null) => void;
};
